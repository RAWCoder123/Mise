import {
  recalculationCycleDefinition,
  type RecalculationCycle,
  type RecalculationRunRecord
} from "../domain/recalculationSchedule";
import type { RecalculationPorts } from "./recalculationCycles";
import type {
  PersistedRecalculationRun,
  RecalculationRunInput
} from "../repositories/repositoryContracts";

/**
 * The slice of the repository this layer needs. Declaring it narrowly keeps the
 * ports factory free of the repository singleton -- and therefore free of the
 * React Native import chain -- so it can be proven in a plain Node test.
 */
export interface RecalculationLedger {
  listRecalculationRuns(
    restaurantId: string,
    options?: { sinceOperatingDate?: string; limit?: number }
  ): Promise<PersistedRecalculationRun[]>;
  recordRecalculationRun(input: RecalculationRunInput): Promise<PersistedRecalculationRun>;
}

/** How far back the schedule needs to look to decide today. */
const LEDGER_LOOKBACK_DAYS = 1;
const LEDGER_LIMIT = 64;

/**
 * Binds the pure recalculation executor to a durable ledger.
 *
 * One factory instance serves one dispatch pass. That matters: `runCycle` is
 * memoized per instance, so when two or three cycles come due at once the
 * recompute happens once while the ledger still records an attempt per cycle.
 * The three cycles differ in *when* they run and *who is accountable*, not yet
 * in *what* is computed, so recomputing three times would churn derived ids for
 * no gain while recording one row would understate coverage.
 */
export function createRecalculationPorts(deps: {
  ledger: RecalculationLedger;
  runCycleWork: (restaurantId: string) => Promise<void>;
  now?: () => Date;
}): RecalculationPorts {
  const clock = deps.now ?? (() => new Date());
  let inFlight: Promise<void> | null = null;

  return {
    async loadRuns(restaurantId: string): Promise<readonly RecalculationRunRecord[]> {
      const runs = await deps.ledger.listRecalculationRuns(restaurantId, {
        sinceOperatingDate: lookbackDate(clock()),
        limit: LEDGER_LIMIT
      });
      // The scheduler only reads the fields that decide the next attempt.
      return runs.map((run) => ({
        restaurantId: run.restaurantId,
        cycle: run.cycle,
        operatingDate: run.operatingDate,
        status: run.status,
        attempt: run.attempt,
        completedAt: run.completedAt,
        failureReason: run.failureReason
      }));
    },

    async recordRun(record, telemetry) {
      const definition = recalculationCycleDefinition(record.cycle);
      const cycleKey = `recalc:${record.restaurantId}:${record.operatingDate}:${record.cycle}`;
      try {
        await deps.ledger.recordRecalculationRun({
          restaurantId: record.restaurantId,
          cycle: record.cycle,
          operatingDate: record.operatingDate,
          status: record.status,
          attempt: record.attempt,
          jobName: definition.jobName,
          monitoringOwner: definition.monitoringOwner,
          startedAt: telemetry.startedAt,
          completedAt: record.completedAt,
          durationMs: telemetry.durationMs,
          timedOut: telemetry.timedOut,
          failureReason: record.failureReason ?? null,
          cycleKey,
          idempotencyKey: `${cycleKey}:attempt-${record.attempt}`
        });
      } catch (error) {
        // A paused Mise is not a failed recalculation. Swallowing the pause
        // leaves the attempt uncounted so the cycle stays due, instead of
        // burning retries toward a dead letter nobody caused.
        if (isOperationalPauseError(error)) return;
        throw error;
      }
    },

    async runCycle(cycle: RecalculationCycle, context) {
      // Every cycle drives the same recompute today, so the first to arrive
      // owns the work and the rest await it.
      void cycle;
      inFlight ??= deps.runCycleWork(context.restaurantId);
      await inFlight;
    }
  };
}

function lookbackDate(now: Date): string {
  return new Date(now.getTime() - LEDGER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Postgres raises 55000 when the restaurant is in read_only or emergency mode.
 */
export function isOperationalPauseError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "55000") return true;
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return message.includes("read-only") || message.includes("operational mode");
}
