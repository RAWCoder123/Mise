import assert from "node:assert/strict";
import test from "node:test";

import {
  RecalculationTimeoutError,
  runDueRecalculationCycles,
  withTimeout,
  type RecalculationPorts,
  type RecalculationRunContext
} from "../services/application/recalculationCycles";
import type {
  RecalculationCycle,
  RecalculationRunRecord
} from "../services/domain/recalculationSchedule";

const restaurantId = "recalc-app-restaurant";
const restaurantTimeZone = "America/New_York";
/** 18:00 restaurant time on 2026-08-05: all three windows are open. */
const eveningUtc = new Date("2026-08-05T22:00:00.000Z");

interface Harness {
  ports: RecalculationPorts;
  recorded: RecalculationRunRecord[];
  ran: RecalculationRunContext[];
}

function harness(options: {
  runs?: RecalculationRunRecord[];
  runCycle?: (cycle: RecalculationCycle, context: RecalculationRunContext) => Promise<void>;
  loadRuns?: () => Promise<readonly RecalculationRunRecord[]>;
  recordRun?: (record: RecalculationRunRecord) => Promise<void>;
} = {}): Harness {
  const recorded: RecalculationRunRecord[] = [];
  const ran: RecalculationRunContext[] = [];
  return {
    recorded,
    ran,
    ports: {
      loadRuns: options.loadRuns ?? (async () => options.runs ?? []),
      recordRun:
        options.recordRun ??
        (async (record) => {
          recorded.push(record);
        }),
      runCycle:
        options.runCycle ??
        (async (cycle, context) => {
          ran.push(context);
          void cycle;
        })
    }
  };
}

test("every due cycle runs once and is written to the run ledger", async () => {
  const test1 = harness();
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.equal(report.scheduleError, null);
  assert.equal(report.operatingDate, "2026-08-05");
  assert.deepEqual(
    report.executions.map((execution) => execution.cycle),
    ["daily_open", "mid_shift", "close"]
  );
  assert.ok(report.executions.every((execution) => execution.status === "succeeded"));
  assert.equal(test1.recorded.length, 3);
  assert.ok(test1.recorded.every((record) => record.status === "succeeded"));
  assert.ok(test1.recorded.every((record) => record.operatingDate === "2026-08-05"));
});

test("the stable idempotency key is handed to the work so providers can dedupe", async () => {
  const test1 = harness();
  await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.deepEqual(
    test1.ran.map((context) => context.idempotencyKey),
    [
      `recalc:${restaurantId}:2026-08-05:daily_open`,
      `recalc:${restaurantId}:2026-08-05:mid_shift`,
      `recalc:${restaurantId}:2026-08-05:close`
    ]
  );
  assert.ok(test1.ran.every((context) => context.attempt === 1));
});

test("an already succeeded cycle is not dispatched again", async () => {
  const test1 = harness({
    runs: [
      {
        restaurantId,
        cycle: "daily_open",
        operatingDate: "2026-08-05",
        status: "succeeded",
        attempt: 1,
        completedAt: "2026-08-05T09:10:00.000Z"
      }
    ]
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.deepEqual(
    report.executions.map((execution) => execution.cycle),
    ["mid_shift", "close"]
  );
  assert.ok(!test1.ran.some((context) => context.idempotencyKey.endsWith("daily_open")));
});

test("one failing cycle is isolated and recorded without cancelling the others", async () => {
  const test1 = harness({
    runCycle: async (cycle) => {
      if (cycle === "mid_shift") throw new Error("Inventory depletion recalculation failed");
    }
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.equal(report.executions.length, 3);
  const midShift = report.executions.find((execution) => execution.cycle === "mid_shift");
  assert.equal(midShift?.status, "failed");
  assert.equal(midShift?.failureReason, "Inventory depletion recalculation failed");
  assert.equal(midShift?.timedOut, false);
  // The cycle behind the failure still ran.
  assert.equal(
    report.executions.find((execution) => execution.cycle === "close")?.status,
    "succeeded"
  );
  assert.equal(
    test1.recorded.find((record) => record.cycle === "mid_shift")?.failureReason,
    "Inventory depletion recalculation failed"
  );
});

test("withTimeout rejects a hung cycle with a typed timeout error", async () => {
  const hung = new Promise<void>(() => {
    /* never settles */
  });

  await assert.rejects(
    () => withTimeout(hung, 10, "recalculation.daily_open exceeded its 10ms timeout"),
    (error: unknown) =>
      error instanceof RecalculationTimeoutError &&
      error.message === "recalculation.daily_open exceeded its 10ms timeout"
  );
});

test("withTimeout passes through a result that lands inside the budget", async () => {
  assert.equal(await withTimeout(Promise.resolve("done"), 5_000, "unused"), "done");
  // A non-positive budget means no timer is armed at all.
  assert.equal(await withTimeout(Promise.resolve("done"), 0, "unused"), "done");
});

test("a timed-out cycle is recorded as failed and flagged as a timeout", async () => {
  const test1 = harness({
    runCycle: async (cycle) => {
      if (cycle === "daily_open") {
        throw new RecalculationTimeoutError("recalculation.daily_open exceeded its 120000ms timeout");
      }
    }
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: new Date("2026-08-05T09:30:00.000Z")
  });

  assert.equal(report.executions.length, 1);
  const execution = report.executions[0];
  assert.equal(execution?.cycle, "daily_open");
  assert.equal(execution?.status, "failed");
  assert.equal(execution?.timedOut, true);
  assert.match(execution?.failureReason ?? "", /exceeded its 120000ms timeout/);
  assert.equal(test1.recorded[0]?.status, "failed");
});

test("an unreadable run ledger fails closed and dispatches nothing", async () => {
  const test1 = harness({
    loadRuns: async () => {
      throw new Error("run ledger unavailable");
    }
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.equal(report.scheduleError, "run ledger unavailable");
  assert.equal(report.schedule, null);
  assert.deepEqual(report.executions, []);
  assert.deepEqual(test1.ran, []);
});

test("a ledger write failure is surfaced on the execution instead of being swallowed", async () => {
  const test1 = harness({
    recordRun: async () => {
      throw new Error("ledger insert rejected");
    }
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.ok(report.executions.length > 0);
  assert.ok(
    report.executions.every((execution) =>
      execution.failureReason?.includes("Run ledger write failed: ledger insert rejected")
    )
  );
});

test("dead-lettered cycles are reported for operator attention, not retried", async () => {
  const runs: RecalculationRunRecord[] = Array.from({ length: 4 }, (_unused, index) => ({
    restaurantId,
    cycle: "close" as const,
    operatingDate: "2026-08-05",
    status: "failed" as const,
    attempt: index + 1,
    completedAt: "2026-08-05T21:30:00.000Z",
    failureReason: "Supplier confirmation endpoint returned 503"
  }));
  const test1 = harness({ runs });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });

  assert.ok(!report.executions.some((execution) => execution.cycle === "close"));
  assert.deepEqual(
    report.needsOperatorAttention.map((decision) => decision.cycle),
    ["close"]
  );
  assert.equal(report.needsOperatorAttention[0]?.monitoringOwner, "owner_admin");
});

test("run telemetry travels alongside the record so the ledger can store it", async () => {
  const telemetry: { cycle: string; startedAt: string; durationMs: number; timedOut: boolean }[] = [];
  const ports: RecalculationPorts = {
    loadRuns: async () => [],
    recordRun: async (record, runTelemetry) => {
      telemetry.push({ cycle: record.cycle, ...runTelemetry });
    },
    runCycle: async (cycle) => {
      if (cycle === "close") {
        throw new RecalculationTimeoutError("recalculation.close exceeded its 180000ms timeout");
      }
    }
  };

  await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports,
    now: eveningUtc
  });

  assert.equal(telemetry.length, 3);
  for (const entry of telemetry) {
    assert.ok(Number.isFinite(Date.parse(entry.startedAt)));
    assert.ok(entry.durationMs >= 0);
  }
  // Only the timed-out cycle carries the timeout flag through to the ledger.
  assert.deepEqual(
    telemetry.filter((entry) => entry.timedOut).map((entry) => entry.cycle),
    ["close"]
  );
});
