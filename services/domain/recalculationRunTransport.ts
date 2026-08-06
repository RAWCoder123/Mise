import type {
  PersistedRecalculationRun,
  RecalculationRunInput
} from "../repositories/repositoryContracts";
import type { RecalculationCycle, RecalculationRunStatus } from "./recalculationSchedule";
import type { RestaurantTaskRequiredRole } from "./restaurantTasks";

/**
 * Row/RPC marshalling for `public.recalculation_runs`. Kept out of
 * `recalculationSchedule` so the scheduling brain stays pure and free of any
 * persistence shape.
 */
export interface PersistedRecalculationRunRow {
  id: string;
  restaurant_id: string;
  cycle: string;
  operating_date: string;
  status: string;
  attempt: number;
  job_name: string;
  monitoring_owner: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  timed_out: boolean;
  failure_reason: string | null;
  cycle_key: string;
  idempotency_key: string;
  recorded_by: string | null;
  correlation_id: string;
  recorded_at: string;
}

const cycles = new Set<RecalculationCycle>(["daily_open", "mid_shift", "close"]);
const statuses = new Set<RecalculationRunStatus>(["succeeded", "failed"]);
const owners = new Set<RestaurantTaskRequiredRole>(["member", "manager", "owner_admin"]);

export function recalculationRunFromPersistedRow(
  row: PersistedRecalculationRunRow
): PersistedRecalculationRun {
  if (!cycles.has(row.cycle as RecalculationCycle)) {
    throw new Error("Recalculation run row has an invalid cycle.");
  }
  if (!statuses.has(row.status as RecalculationRunStatus)) {
    throw new Error("Recalculation run row has an invalid status.");
  }
  if (!owners.has(row.monitoring_owner as RestaurantTaskRequiredRole)) {
    throw new Error("Recalculation run row has an invalid monitoring owner.");
  }

  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    cycle: row.cycle as RecalculationCycle,
    // `date` columns come back as YYYY-MM-DD; keep only that shape.
    operatingDate: row.operating_date.slice(0, 10),
    status: row.status as RecalculationRunStatus,
    attempt: row.attempt,
    jobName: row.job_name,
    monitoringOwner: row.monitoring_owner as RestaurantTaskRequiredRole,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    timedOut: row.timed_out,
    failureReason: row.failure_reason,
    cycleKey: row.cycle_key,
    idempotencyKey: row.idempotency_key,
    recordedBy: row.recorded_by,
    correlationId: row.correlation_id,
    recordedAt: row.recorded_at
  };
}

export function recordRecalculationRunRpcArguments(input: RecalculationRunInput) {
  return {
    p_restaurant_id: input.restaurantId.trim(),
    p_cycle: input.cycle,
    p_operating_date: input.operatingDate,
    p_status: input.status,
    p_attempt: input.attempt,
    p_job_name: input.jobName,
    p_monitoring_owner: input.monitoringOwner,
    p_started_at: input.startedAt,
    p_completed_at: input.completedAt,
    p_duration_ms: input.durationMs,
    p_timed_out: input.timedOut,
    p_failure_reason: input.failureReason,
    p_cycle_key: input.cycleKey,
    p_idempotency_key: input.idempotencyKey
  };
}
