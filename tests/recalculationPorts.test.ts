import assert from "node:assert/strict";
import test from "node:test";

import { runDueRecalculationCycles } from "../services/application/recalculationCycles";
import {
  createRecalculationPorts,
  isOperationalPauseError
} from "../services/application/recalculationPorts";
import { summarizeRecalculationAttention } from "../services/presentation/recalculationPresentation";
import type { RecalculationCycleReport } from "../services/application/recalculationCycles";
import type { RecalculationLedger } from "../services/application/recalculationPorts";
import type {
  PersistedRecalculationRun,
  RecalculationRunInput
} from "../services/repositories/repositoryContracts";
import type { RecalculationDecision } from "../services/domain/recalculationSchedule";

const restaurantId = "ports-restaurant";
const restaurantTimeZone = "America/New_York";
/** 18:00 restaurant time on 2026-08-05: all three windows are open. */
const eveningUtc = new Date("2026-08-05T22:00:00.000Z");

function fakeLedger(overrides: Partial<RecalculationLedger> = {}) {
  const recorded: RecalculationRunInput[] = [];
  const ledger: RecalculationLedger = {
  listRecalculationRuns: async () => [],
  recordRecalculationRun: async (input: RecalculationRunInput) => {
    recorded.push(input);
    return {
      ...input,
      id: `run-${recorded.length}`,
      recordedBy: "user-1",
      recordedAt: input.completedAt,
      correlationId: `corr-${recorded.length}`
    } satisfies PersistedRecalculationRun;
  },
  ...overrides
  };
  return { ledger, recorded };
}

test("several due cycles share one recompute but each records its own ledger row", async () => {
  const { ledger, recorded } = fakeLedger();
  let recomputes = 0;

  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: createRecalculationPorts({
      ledger,
      runCycleWork: async () => {
        recomputes += 1;
      }
    }),
    now: eveningUtc
  });
  assert.equal(report.executions.length, 3);

  // The three cycles drive identical work today, so recomputing three times
  // would churn derived ids for no gain -- but coverage still needs three rows.
  assert.equal(recomputes, 1);
  assert.equal(recorded.length, 3);
  assert.deepEqual(
    recorded.map((run) => run.cycle),
    ["daily_open", "mid_shift", "close"]
  );
});

test("recorded runs carry the cycle's ownership, budget, and replay keys", async () => {
  const { ledger, recorded } = fakeLedger();

  await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: createRecalculationPorts({ ledger, runCycleWork: async () => {} }),
    now: eveningUtc
  });

  const close = recorded.find((run) => run.cycle === "close");
  assert.ok(close);
  assert.equal(close.monitoringOwner, "owner_admin");
  assert.equal(close.jobName, "recalculation.close");
  assert.equal(close.operatingDate, "2026-08-05");
  assert.equal(close.attempt, 1);
  assert.equal(close.status, "succeeded");
  assert.equal(close.failureReason, null);
  assert.equal(close.timedOut, false);
  assert.equal(close.cycleKey, `recalc:${restaurantId}:2026-08-05:close`);
  assert.equal(close.idempotencyKey, `recalc:${restaurantId}:2026-08-05:close:attempt-1`);
  assert.ok(Number.isFinite(Date.parse(close.startedAt)));
  assert.ok(close.durationMs >= 0);

  const open = recorded.find((run) => run.cycle === "daily_open");
  assert.equal(open?.monitoringOwner, "manager");
});

test("prior ledger rows are mapped down to the fields the scheduler reads", async () => {
  const stored: PersistedRecalculationRun = {
  id: "run-existing",
  restaurantId,
  cycle: "daily_open",
  operatingDate: "2026-08-05",
  status: "succeeded",
  attempt: 1,
  jobName: "recalculation.daily_open",
  monitoringOwner: "manager",
  startedAt: "2026-08-05T09:00:00.000Z",
  completedAt: "2026-08-05T09:00:04.000Z",
  durationMs: 4000,
  timedOut: false,
  failureReason: null,
  cycleKey: `recalc:${restaurantId}:2026-08-05:daily_open`,
  idempotencyKey: `recalc:${restaurantId}:2026-08-05:daily_open:attempt-1`,
  recordedBy: "user-1",
  recordedAt: "2026-08-05T09:00:04.000Z",
  correlationId: "corr-existing"
  };
  const { ledger, recorded } = fakeLedger({
  listRecalculationRuns: async () => [stored]
  });

  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: createRecalculationPorts({ ledger, runCycleWork: async () => {} }),
    now: eveningUtc
  });
  // The stored success satisfies daily_open, so only two cycles dispatch.
  assert.deepEqual(
    report.executions.map((execution) => execution.cycle),
    ["mid_shift", "close"]
  );

  assert.equal(recorded.length, 2);
});

test("an unreadable ledger fails closed rather than reporting all clear", async () => {
  const { ledger } = fakeLedger({
  listRecalculationRuns: async () => {
    throw new Error("ledger unavailable");
  }
  });

  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: createRecalculationPorts({ ledger, runCycleWork: async () => {} }),
    now: eveningUtc
  });
  assert.equal(report.scheduleError, "ledger unavailable");
  assert.deepEqual(report.executions, []);
  assert.equal(summarizeRecalculationAttention(report)?.state, "unavailable");
});

test("a paused Mise defers instead of burning an attempt toward a fake dead letter", async () => {
  const pause = Object.assign(new Error("Operational mode is read-only"), { code: "55000" });
  const { ledger } = fakeLedger({
  recordRecalculationRun: async () => {
    throw pause;
  }
  });

  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: createRecalculationPorts({ ledger, runCycleWork: async () => {} }),
    now: eveningUtc
  });
  // The pause is swallowed, so no execution is marked as a ledger failure.
  assert.ok(
    report.executions.every((execution) => execution.failureReason === null),
    "a pause must not be reported as a run failure"
  );

  assert.equal(isOperationalPauseError(pause), true);
  assert.equal(isOperationalPauseError(new Error("ledger insert rejected")), false);
});

test("a genuine ledger write failure is still surfaced", async () => {
  const { ledger } = fakeLedger({
  recordRecalculationRun: async () => {
    throw new Error("ledger insert rejected");
  }
  });

  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: createRecalculationPorts({ ledger, runCycleWork: async () => {} }),
    now: eveningUtc
  });
  assert.ok(
    report.executions.every((execution) =>
      execution.failureReason?.includes("ledger insert rejected")
    )
  );
});

test("attention is summarized only when there is something an operator must do", () => {
  const clean: RecalculationCycleReport = {
  restaurantId,
  operatingDate: "2026-08-05",
  evaluatedAt: eveningUtc.toISOString(),
  schedule: null,
  executions: [],
  needsOperatorAttention: [],
  scheduleError: null
  };
  assert.equal(summarizeRecalculationAttention(clean), null);

  const deadLetter = { cycle: "close", monitoringOwner: "owner_admin" } as RecalculationDecision;
  const attention = summarizeRecalculationAttention({
  ...clean,
  needsOperatorAttention: [deadLetter]
  });
  assert.equal(attention?.state, "attention");
  assert.equal(attention?.deadLetteredCount, 1);
  assert.deepEqual(attention?.cycles, ["close"]);
  assert.equal(attention?.owner, "owner_admin");

  // Disagreeing owners must not be collapsed into a misleading single name.
  const mixed = summarizeRecalculationAttention({
  ...clean,
  needsOperatorAttention: [
    deadLetter,
    { cycle: "mid_shift", monitoringOwner: "manager" } as RecalculationDecision
  ]
  });
  assert.equal(mixed?.deadLetteredCount, 2);
  assert.equal(mixed?.owner, null);
});
