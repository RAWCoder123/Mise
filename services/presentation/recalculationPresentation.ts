import type { RecalculationCycleReport } from "../application/recalculationCycles";
import {
  isRecalculationDeadLetter,
  type RecalculationHistoryFilter
} from "../domain/recalculationHistory";
import type { RecalculationCycle } from "../domain/recalculationSchedule";
import { RECALCULATION_MAX_ATTEMPTS } from "../domain/recalculationSchedule";
import type { RestaurantTaskRequiredRole } from "../domain/restaurantTasks";
import type { PersistedRecalculationRun } from "../repositories/repositoryContracts";
import type { MessageKey } from "../../i18n/catalog";
import { taskRoleLabelKey } from "./taskRoleLabel";

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

export type RecalculationHistoryBadgeTone = "danger" | "warning" | "success" | "neutral";

/** Compact row fields for the recalculation history browse screen. */
export interface RecalculationHistoryRowView {
  id: string;
  cycleKey: MessageKey;
  statusKey: MessageKey;
  statusTone: RecalculationHistoryBadgeTone;
  deadLettered: boolean;
  timedOut: boolean;
  attemptLabelKey: MessageKey;
  attempt: number;
  maxAttempts: number;
  operatingDate: string;
  completedAt: string;
  durationMs: number;
  monitoringOwnerKey: MessageKey;
  failureReason: string | null;
  jobName: string;
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

export function presentRecalculationHistoryRow(
  run: PersistedRecalculationRun,
  maxAttempts: number = RECALCULATION_MAX_ATTEMPTS
): RecalculationHistoryRowView {
  const deadLettered = isRecalculationDeadLetter(run, maxAttempts);
  return {
    id: run.id,
    cycleKey: recalculationCycleMessageKey(run.cycle),
    statusKey: deadLettered
      ? "recalculationHistory.status.deadLettered"
      : run.status === "succeeded"
        ? "recalculationHistory.status.succeeded"
        : "recalculationHistory.status.failed",
    statusTone: deadLettered
      ? "danger"
      : run.status === "failed" || run.timedOut
        ? "warning"
        : "success",
    deadLettered,
    timedOut: run.timedOut,
    attemptLabelKey: "recalculationHistory.attempt",
    attempt: run.attempt,
    maxAttempts,
    operatingDate: run.operatingDate,
    completedAt: run.completedAt,
    durationMs: run.durationMs,
    monitoringOwnerKey: taskRoleLabelKey(run.monitoringOwner),
    failureReason: run.failureReason,
    jobName: run.jobName
  };
}

export function recalculationCycleMessageKey(cycle: RecalculationCycle): MessageKey {
  if (cycle === "daily_open") return "recalculationHistory.cycle.daily_open";
  if (cycle === "mid_shift") return "recalculationHistory.cycle.mid_shift";
  return "recalculationHistory.cycle.close";
}

export function recalculationHistoryFilterMessageKey(
  filter: RecalculationHistoryFilter
): MessageKey {
  return filter === "attention"
    ? "recalculationHistory.filter.attention"
    : "recalculationHistory.filter.all";
}
