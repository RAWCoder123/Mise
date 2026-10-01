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
 * Open and mid-shift still share one planning recompute when they come due
 * together: they differ in timing and accountability, not in signal math.
 * Close runs separately so it can merge waste, count-variance, and carryover
 * stock reconciliation without writing that close-only evidence into earlier
 * cycles.
 */
export function createRecalculationPorts(deps: {
  ledger: RecalculationLedger;
  runCycleWork: (restaurantId: string, cycle: RecalculationCycle) => Promise<void>;
  now?: () => Date;
}): RecalculationPorts {
  const clock = deps.now ?? (() => new Date());
  let planningInFlight: Promise<void> | null = null;

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
      if (cycle === "close") {
        // Close owns reconciliation evidence and must not reuse the open/mid
        // planning memo, which would omit close-only insight merges.
        await deps.runCycleWork(context.restaurantId, cycle);
        return;
      }
      planningInFlight ??= deps.runCycleWork(context.restaurantId, cycle);
      await planningInFlight;
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
