import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertRecalculationRunsTenantScoped,
  filterRecalculationHistory,
  isRecalculationAttentionRun,
  isRecalculationDeadLetter,
  sortRecalculationHistory
} from "../services/domain/recalculationHistory";
import { RECALCULATION_MAX_ATTEMPTS } from "../services/domain/recalculationSchedule";
import {
  presentRecalculationHistoryRow
} from "../services/presentation/recalculationPresentation";
import type { PersistedRecalculationRun } from "../services/repositories/repositoryContracts";

const restaurantId = "rest_recalc_history";

function run(overrides: Partial<PersistedRecalculationRun> = {}): PersistedRecalculationRun {
  return {
    id: "run_1",
    restaurantId,
    cycle: "daily_open",
    operatingDate: "2026-09-02",
    status: "failed",
    attempt: 4,
    jobName: "recalculation.daily_open",
    monitoringOwner: "manager",
    startedAt: "2026-09-02T12:00:00.000Z",
    completedAt: "2026-09-02T12:02:00.000Z",
    durationMs: 120_000,
    timedOut: true,
    failureReason: "Timed out after inventory projection.",
    cycleKey: "recalculation:2026-09-02:daily_open",
    idempotencyKey: "recalculation:2026-09-02:daily_open:attempt-4",
    recordedBy: "user_1",
    recordedAt: "2026-09-02T12:02:01.000Z",
    correlationId: "corr_1",
    ...overrides
  };
}

test("dead letters require a failed attempt at the max retry budget", () => {
  assert.equal(isRecalculationDeadLetter(run()), true);
  assert.equal(isRecalculationDeadLetter(run({ attempt: 3 })), false);
  assert.equal(isRecalculationDeadLetter(run({ status: "succeeded", timedOut: false, failureReason: null })), false);
  assert.equal(isRecalculationAttentionRun(run({ attempt: 2, timedOut: false })), true);
  assert.equal(
    isRecalculationAttentionRun(
      run({ status: "succeeded", attempt: 1, timedOut: false, failureReason: null })
    ),
    false
  );
});

test("history filter and sort prefer newest attention attempts", () => {
  const succeeded = run({
    id: "run_ok",
    cycle: "mid_shift",
    status: "succeeded",
    attempt: 1,
    timedOut: false,
    failureReason: null,
    completedAt: "2026-09-02T15:00:00.000Z",
    jobName: "recalculation.mid_shift"
  });
  const earlierFail = run({
    id: "run_early",
    attempt: 3,
    completedAt: "2026-09-02T11:00:00.000Z",
    timedOut: false
  });
  const deadLetter = run();
  const olderDay = run({
    id: "run_old",
    operatingDate: "2026-09-01",
    attempt: 4,
    completedAt: "2026-09-01T12:00:00.000Z"
  });

  const attention = filterRecalculationHistory(
    [succeeded, earlierFail, deadLetter, olderDay],
    "attention"
  );
  assert.deepEqual(
    attention.map((entry) => entry.id),
    ["run_early", "run_1", "run_old"]
  );
  assert.deepEqual(
    sortRecalculationHistory(attention).map((entry) => entry.id),
    ["run_1", "run_early", "run_old"]
  );
  assert.equal(filterRecalculationHistory([succeeded, deadLetter], "all").length, 2);
});

test("presentation labels dead letters and reuses task role keys", () => {
  const row = presentRecalculationHistoryRow(run());
  assert.equal(row.statusKey, "recalculationHistory.status.deadLettered");
  assert.equal(row.statusTone, "danger");
  assert.equal(row.cycleKey, "recalculationHistory.cycle.daily_open");
  assert.equal(row.monitoringOwnerKey, "tasks.assigned.manager");
  assert.equal(row.maxAttempts, RECALCULATION_MAX_ATTEMPTS);
  assert.equal(row.timedOut, true);

  const ok = presentRecalculationHistoryRow(
    run({ status: "succeeded", attempt: 1, timedOut: false, failureReason: null })
  );
  assert.equal(ok.statusKey, "recalculationHistory.status.succeeded");
  assert.equal(ok.statusTone, "success");
});

test("tenant assert fails closed on cross-restaurant rows", () => {
  assertRecalculationRunsTenantScoped([run()], restaurantId);
  assert.throws(() => assertRecalculationRunsTenantScoped([run()], "other"));
  assert.throws(() =>
    assertRecalculationRunsTenantScoped([run({ restaurantId: "other" })], restaurantId)
  );
});

test("home attention CTA routes to recalculation history, not mixed activity", () => {
  const home = readFileSync("app/(tabs)/home.tsx", "utf8");
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const smoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const screen = readFileSync("app/more/recalculation-runs.tsx", "utf8");
  const service = readFileSync("services/miseService.ts", "utf8");

  assert.match(home, /home\.recalculation\.action[\s\S]*\/more\/recalculation-runs/);
  assert.doesNotMatch(
    home,
    /home\.recalculation\.action[\s\S]*onAction=\{\(\) => router\.push\("\/more\/activity"\)\}/
  );
  assert.match(more, /\/more\/recalculation-runs/);
  assert.match(layout, /more\/recalculation-runs/);
  assert.match(smoke, /"\/more\/recalculation-runs"/);
  assert.match(screen, /resolveRestaurantScopedHubLoadState/);
  assert.match(screen, /hubReady\s*\?\s*filterRecalculationHistory/);
  assert.match(service, /application\/recalculationHistory/);
});
