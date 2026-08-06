import type { RecalculationCycleReport } from "../application/recalculationCycles";
import type { RecalculationCycle } from "../domain/recalculationSchedule";
import type { RestaurantTaskRequiredRole } from "../domain/restaurantTasks";

/**
 * Screen-safe summary of whether the background recalculation loop needs a
 * human. Pure, so the decision is testable without rendering anything.
 *
 * Section 26 forbids hiding background-job failures, but it does not ask for a
 * banner on a healthy day: this returns null when there is nothing to say.
 */
export interface RecalculationAttentionSummary {
  state: "attention" | "unavailable";
  deadLetteredCount: number;
  cycles: RecalculationCycle[];
  /** Role accountable for reviewing the dead letters, when they agree on one. */
  owner: RestaurantTaskRequiredRole | null;
}

export function summarizeRecalculationAttention(
  report: RecalculationCycleReport
): RecalculationAttentionSummary | null {
  // An unreadable schedule is its own kind of degraded: Mise cannot even say
  // whether the loop ran, and claiming "all clear" would be a lie.
  if (report.scheduleError !== null) {
    return { state: "unavailable", deadLetteredCount: 0, cycles: [], owner: null };
  }

  const deadLettered = report.needsOperatorAttention;
  if (deadLettered.length === 0) return null;

  const owners = new Set(deadLettered.map((decision) => decision.monitoringOwner));
  return {
    state: "attention",
    deadLetteredCount: deadLettered.length,
    cycles: deadLettered.map((decision) => decision.cycle),
    // Only name an owner when every dead letter points at the same one.
    owner: owners.size === 1 ? (deadLettered[0]?.monitoringOwner ?? null) : null
  };
}
