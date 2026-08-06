import assert from "node:assert/strict";
import test from "node:test";

import {
  RECALCULATION_MAX_ATTEMPTS,
  buildRecalculationSchedule,
  recalculationBackoffMs,
  recalculationCycles,
  serviceDayInTimeZone
} from "../services/domain/recalculationSchedule";
import type {
  RecalculationCycle,
  RecalculationRunRecord
} from "../services/domain/recalculationSchedule";

const restaurantId = "recalc-restaurant";
const timeZone = "America/New_York";

function scheduleAt(iso: string, runs: RecalculationRunRecord[] = []) {
  return buildRecalculationSchedule({
    restaurantId,
    restaurantTimeZone: timeZone,
    runs,
    now: new Date(iso)
  });
}

function decisionFor(iso: string, cycle: RecalculationCycle, runs: RecalculationRunRecord[] = []) {
  const decision = scheduleAt(iso, runs).decisions.find((entry) => entry.cycle === cycle);
  assert.ok(decision, `expected a decision for ${cycle}`);
  return decision;
}

function run(overrides: Partial<RecalculationRunRecord> & { cycle: RecalculationCycle }) {
  return {
    restaurantId,
    operatingDate: "2026-08-05",
    status: "failed" as const,
    attempt: 1,
    completedAt: "2026-08-05T09:00:00.000Z",
    ...overrides
  } satisfies RecalculationRunRecord;
}

test("the service day rolls at 04:00 restaurant time, not at UTC midnight", () => {
  // 01:30 local on Aug 5 still belongs to the Aug 4 service day.
  assert.equal(serviceDayInTimeZone(new Date("2026-08-05T05:30:00.000Z"), timeZone), "2026-08-04");
  // 05:30 local on Aug 5 has crossed the rollover.
  assert.equal(serviceDayInTimeZone(new Date("2026-08-05T09:30:00.000Z"), timeZone), "2026-08-05");
  // 20:00 local on Aug 5 is still Aug 5 even though UTC has reached Aug 6.
  assert.equal(serviceDayInTimeZone(new Date("2026-08-06T00:00:00.000Z"), timeZone), "2026-08-05");
});

test("every cycle is evaluated in a stable order for the current service day", () => {
  const schedule = scheduleAt("2026-08-05T09:30:00.000Z");
  assert.deepEqual(
    schedule.decisions.map((decision) => decision.cycle),
    recalculationCycles()
  );
  assert.equal(schedule.operatingDate, "2026-08-05");
  assert.ok(schedule.decisions.every((decision) => decision.operatingDate === "2026-08-05"));
});

test("a cycle is due once its restaurant-local window opens and waits before it", () => {
  // 05:30 local: the opening window is open, mid-shift and close are not.
  const schedule = scheduleAt("2026-08-05T09:30:00.000Z");
  const byCycle = new Map(schedule.decisions.map((decision) => [decision.cycle, decision]));

  assert.equal(byCycle.get("daily_open")?.state, "due");
  assert.equal(byCycle.get("mid_shift")?.state, "waiting");
  assert.equal(byCycle.get("close")?.state, "waiting");
  assert.deepEqual(schedule.dueCycles, ["daily_open"]);

  // 18:00 local: all three windows have opened, so a missed cycle still catches up.
  const evening = scheduleAt("2026-08-05T22:00:00.000Z");
  assert.deepEqual(evening.dueCycles, ["daily_open", "mid_shift", "close"]);
});

test("a waiting cycle reports when its window opens in restaurant time", () => {
  const decision = decisionFor("2026-08-05T09:30:00.000Z", "close");
  // 17:00 EDT on Aug 5 is 21:00 UTC.
  assert.equal(decision.windowOpensAt, "2026-08-05T21:00:00.000Z");
  assert.equal(decision.nextEligibleAt, decision.windowOpensAt);
  assert.match(decision.reason, /17:00 restaurant time/);
});

test("a succeeded run makes the cycle idempotent for the rest of the service day", () => {
  const runs = [
    run({ cycle: "daily_open", status: "succeeded", attempt: 1, completedAt: "2026-08-05T09:05:00.000Z" })
  ];
  const decision = decisionFor("2026-08-05T14:00:00.000Z", "daily_open", runs);

  assert.equal(decision.state, "satisfied");
  assert.equal(decision.attemptKey, null);
  assert.equal(decision.surfaceToOperator, false);
  assert.ok(!scheduleAt("2026-08-05T14:00:00.000Z", runs).dueCycles.includes("daily_open"));
});

test("the idempotency key is stable across retries while each attempt key is unique", () => {
  const first = decisionFor("2026-08-05T09:30:00.000Z", "daily_open");
  const retry = decisionFor("2026-08-05T09:30:00.000Z", "daily_open", [
    run({ cycle: "daily_open", attempt: 1, completedAt: "2026-08-05T09:00:00.000Z" })
  ]);

  assert.equal(first.idempotencyKey, retry.idempotencyKey);
  assert.equal(first.idempotencyKey, `recalc:${restaurantId}:2026-08-05:daily_open`);
  assert.notEqual(first.attemptKey, retry.attemptKey);
  assert.equal(first.attemptKey, `${first.idempotencyKey}:attempt-1`);
  assert.equal(retry.attemptKey, `${retry.idempotencyKey}:attempt-2`);
});

test("a failed attempt is held in exponential backoff and then becomes due", () => {
  assert.equal(recalculationBackoffMs(1), 120_000);
  assert.equal(recalculationBackoffMs(2), 240_000);
  assert.equal(recalculationBackoffMs(3), 480_000);
  // The ceiling keeps a struggling cycle retryable within the same service day.
  assert.equal(recalculationBackoffMs(20), 1_800_000);

  const runs = [
    run({ cycle: "daily_open", attempt: 1, completedAt: "2026-08-05T10:00:00.000Z", failureReason: "POS sync timed out" })
  ];

  const held = decisionFor("2026-08-05T10:01:00.000Z", "daily_open", runs);
  assert.equal(held.state, "backoff");
  assert.equal(held.attemptKey, null);
  assert.equal(held.nextEligibleAt, "2026-08-05T10:02:00.000Z");
  assert.equal(held.lastFailureReason, "POS sync timed out");

  const released = decisionFor("2026-08-05T10:02:30.000Z", "daily_open", runs);
  assert.equal(released.state, "due");
  assert.equal(released.attempt, 2);
  assert.match(released.reason, /attempt 2 of 4/);
});

test("exhausted attempts dead-letter the cycle and surface it to a named owner", () => {
  const runs = Array.from({ length: RECALCULATION_MAX_ATTEMPTS }, (_unused, index) =>
    run({
      cycle: "close",
      attempt: index + 1,
      completedAt: `2026-08-05T2${index}:00:00.000Z`.replace("2026-08-05T24", "2026-08-05T23"),
      failureReason: "Supplier confirmation endpoint returned 503"
    })
  );
  const decision = decisionFor("2026-08-06T02:00:00.000Z", "close", runs);

  assert.equal(decision.state, "dead_lettered");
  assert.equal(decision.attemptKey, null);
  assert.equal(decision.nextEligibleAt, null);
  // Section 26 forbids hiding background-job failures.
  assert.equal(decision.surfaceToOperator, true);
  assert.equal(decision.monitoringOwner, "owner_admin");
  assert.match(decision.reason, /owner or admin/);
  assert.match(decision.reason, /Supplier confirmation endpoint returned 503/);

  const schedule = scheduleAt("2026-08-06T02:00:00.000Z", runs);
  assert.deepEqual(
    schedule.needsOperatorAttention.map((entry) => entry.cycle),
    ["close"]
  );
  assert.ok(!schedule.dueCycles.includes("close"));
});

test("a dead-lettered cycle without a recorded reason still says so honestly", () => {
  const runs = Array.from({ length: RECALCULATION_MAX_ATTEMPTS }, (_unused, index) =>
    run({ cycle: "mid_shift", attempt: index + 1, completedAt: "2026-08-05T15:00:00.000Z", failureReason: "   " })
  );
  const decision = decisionFor("2026-08-05T18:00:00.000Z", "mid_shift", runs);

  assert.equal(decision.lastFailureReason, null);
  assert.match(decision.reason, /No failure reason was recorded/);
});

test("each cycle carries explicit monitoring ownership, a job name, and a timeout", () => {
  for (const decision of scheduleAt("2026-08-05T22:00:00.000Z").decisions) {
    assert.ok(decision.jobName.startsWith("recalculation."));
    assert.ok(decision.timeoutMs > 0);
    assert.ok(["member", "manager", "owner_admin"].includes(decision.monitoringOwner));
    assert.equal(decision.maxAttempts, RECALCULATION_MAX_ATTEMPTS);
  }
});

test("runs from other service days never satisfy or block today", () => {
  const runs = [
    run({ cycle: "daily_open", status: "succeeded", attempt: 1, operatingDate: "2026-08-04" })
  ];
  const decision = decisionFor("2026-08-05T09:30:00.000Z", "daily_open", runs);

  assert.equal(decision.state, "due");
  assert.equal(decision.attempt, 1);
});

test("scheduling fails closed on missing identity or cross-restaurant evidence", () => {
  assert.throws(
    () => buildRecalculationSchedule({ restaurantId: "  ", restaurantTimeZone: timeZone, runs: [] }),
    /requires a restaurant/
  );
  assert.throws(
    () => buildRecalculationSchedule({ restaurantId, restaurantTimeZone: "  ", runs: [] }),
    /requires a restaurant timezone/
  );
  assert.throws(
    () =>
      buildRecalculationSchedule({
        restaurantId,
        restaurantTimeZone: timeZone,
        runs: [run({ cycle: "close", restaurantId: "another-restaurant" })]
      }),
    /cross-restaurant/
  );
});
