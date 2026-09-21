import type { PosIntegration } from "../../types/mise";

export type PosPlanningSyncStatus = "fresh" | "stale" | "unknown";

export function normalizePosPlanningSyncStatus(value: unknown): PosPlanningSyncStatus {
  if (value === "fresh" || value === "stale" || value === "unknown") return value;
  return "unknown";
}

/** Sales are connected but planning has not successfully refreshed after the latest sync. */
export function isPosPlanningSyncStale(integration: PosIntegration): boolean {
  return integration.status === "connected" && integration.planning_sync_status === "stale";
}

/** Operator-visible attention when a failed signal refresh left planning behind sales. */
export function posPlanningNeedsOperatorAttention(integration: PosIntegration): boolean {
  return isPosPlanningSyncStale(integration) && Boolean(integration.planning_sync_error_code);
}
