import assert from "node:assert/strict";
import test from "node:test";

import {
  RECALCULATION_MACHINE_RUNNER_MAX_TARGETS,
  normalizeLimit,
  runMachineRecalculationPass,
  type MachineRecalculationPorts
} from "../services/application/recalculationMachineRunner";
import type { RecalculationRunInput } from "../services/repositories/repositoryContracts";

test("normalizeLimit caps the machine runner batch size", () => {
  assert.equal(normalizeLimit(undefined), RECALCULATION_MACHINE_RUNNER_MAX_TARGETS);
  assert.equal(normalizeLimit(0), 1);
  assert.equal(normalizeLimit(3.9), 3);
  assert.equal(normalizeLimit(1000), RECALCULATION_MACHINE_RUNNER_MAX_TARGETS);
});

test("machine runner skips restaurants without a manager-class signal actor", async () => {
  const recorded: RecalculationRunInput[] = [];
  const refreshed: string[] = [];
  const ports = createPorts({
    targets: [{ restaurantId: "r1", timeZone: "America/New_York" }],
    signalActor: null,
    recorded,
    refreshed
  });

  const report = await runMachineRecalculationPass({
    ports,
    now: new Date("2026-10-08T15:00:00.000Z")
  });

  assert.equal(report.targetCount, 1);
  assert.equal(report.results[0]?.status, "skipped");
  assert.match(report.results[0]?.reason ?? "", /No active owner/);
  assert.equal(recorded.length, 0);
  assert.equal(refreshed.length, 0);
});

test("machine runner refreshes signals and records machine ledger attempts when due", async () => {
  const recorded: RecalculationRunInput[] = [];
  const refreshed: string[] = [];
  const ports = createPorts({
    targets: [{ restaurantId: "r1", timeZone: "America/New_York" }],
    signalActor: "user-owner",
    recorded,
    refreshed
  });

  // 15:00 UTC is 11:00 America/New_York on 2026-10-08 (EDT), so daily_open and
  // mid_shift are due while close has not opened yet.
  const report = await runMachineRecalculationPass({
    ports,
    now: new Date("2026-10-08T15:00:00.000Z")
  });

  assert.equal(report.results[0]?.status, "completed");
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0], "r1");
  assert.ok(recorded.length >= 1);
  assert.ok(recorded.every((run) => run.restaurantId === "r1"));
  assert.ok(recorded.some((run) => run.cycle === "daily_open"));
  assert.ok(recorded.some((run) => run.cycle === "mid_shift"));
  assert.equal(
    recorded.some((run) => run.cycle === "close"),
    false
  );
});

test("machine runner can target one restaurant and reports missing targets", async () => {
  const ports = createPorts({
    targets: [{ restaurantId: "r1", timeZone: "America/New_York" }],
    signalActor: "user-owner",
    recorded: [],
    refreshed: []
  });

  const missing = await runMachineRecalculationPass({
    ports,
    restaurantId: "missing",
    now: new Date("2026-10-08T15:00:00.000Z")
  });
  assert.equal(missing.results[0]?.status, "skipped");
  assert.match(missing.results[0]?.reason ?? "", /not an eligible/);

  const hit = await runMachineRecalculationPass({
    ports,
    restaurantId: "r1",
    now: new Date("2026-10-08T15:00:00.000Z")
  });
  assert.equal(hit.targetCount, 1);
  assert.equal(hit.results[0]?.restaurantId, "r1");
});

function createPorts(input: {
  targets: { restaurantId: string; timeZone: string }[];
  signalActor: string | null;
  recorded: RecalculationRunInput[];
  refreshed: string[];
}): MachineRecalculationPorts {
  return {
    listTargets: async () => input.targets,
    resolveSignalActor: async () => input.signalActor,
    listRuns: async () => [],
    recordMachineRun: async (run) => {
      input.recorded.push(run);
    },
    refreshSignals: async (restaurantId) => {
      input.refreshed.push(restaurantId);
    }
  };
}
