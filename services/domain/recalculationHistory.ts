import type { PersistedRecalculationRun } from "../repositories/repositoryContracts";
import {
  RECALCULATION_MAX_ATTEMPTS,
  type RecalculationCycle
} from "./recalculationSchedule";

/**
 * Read-model helpers for the recalculation run ledger browse screen.
 *
 * The ledger itself is append-only and schedule-owned. This module only decides
 * which recorded attempts an operator should see first — it never invents runs
 * or changes retry / dead-letter semantics.
 */

export const RECALCULATION_HISTORY_FILTERS = ["attention", "all"] as const;
export type RecalculationHistoryFilter = (typeof RECALCULATION_HISTORY_FILTERS)[number];

export const RECALCULATION_HISTORY_CYCLES: readonly RecalculationCycle[] = [
  "daily_open",
  "mid_shift",
  "close"
];

/** A cycle that exhausted retries and needs a human, not another silent attempt. */
export function isRecalculationDeadLetter(
  run: Pick<PersistedRecalculationRun, "status" | "attempt">,
  maxAttempts: number = RECALCULATION_MAX_ATTEMPTS
): boolean {
  return run.status === "failed" && run.attempt >= maxAttempts;
}

/**
 * Attention filter: dead letters and other failed / timed-out attempts that still
 * deserve operator eyes. Successful runs stay on the "all" filter.
 */
export function isRecalculationAttentionRun(
  run: Pick<PersistedRecalculationRun, "status" | "attempt" | "timedOut">,
  maxAttempts: number = RECALCULATION_MAX_ATTEMPTS
): boolean {
  if (isRecalculationDeadLetter(run, maxAttempts)) return true;
  if (run.status === "failed") return true;
  return run.timedOut;
}

export function assertRecalculationRunsTenantScoped(
  runs: readonly PersistedRecalculationRun[],
  restaurantId: string
): void {
  const normalized = restaurantId.trim();
  if (!normalized) throw new Error("Missing restaurant workspace.");
  if (runs.some((run) => run.restaurantId !== normalized)) {
    throw new Error("Recalculation runs failed restaurant scope validation.");
  }
}

export function filterRecalculationHistory(
  runs: readonly PersistedRecalculationRun[],
  filter: RecalculationHistoryFilter,
  maxAttempts: number = RECALCULATION_MAX_ATTEMPTS
): PersistedRecalculationRun[] {
  if (filter === "all") return [...runs];
  return runs.filter((run) => isRecalculationAttentionRun(run, maxAttempts));
}

/**
 * Newest operating day first; within a day, newest attempt first so the latest
 * failure is what an operator sees without expanding older retries.
 */
export function sortRecalculationHistory(
  runs: readonly PersistedRecalculationRun[]
): PersistedRecalculationRun[] {
  return [...runs].sort((left, right) => {
    const byDate = right.operatingDate.localeCompare(left.operatingDate);
    if (byDate !== 0) return byDate;
    const byAttempt = right.attempt - left.attempt;
    if (byAttempt !== 0) return byAttempt;
    return right.completedAt.localeCompare(left.completedAt);
  });
}
