/**
 * Structural audit evidence for Mise-action execution-time attribution.
 *
 * `mise_actions.executed_at` is nullable because non-executed statuses
 * (`prepared`, `waiting_for_approval`, `failed`, `unverified`, …) and
 * failure UPDATEs legitimately leave it null. Hosted writers that advance an
 * action to `executed` stamp `executed_at` (foundation supplier-order
 * acceptance coalesces `sent_at` / `now()`, and the historical backfill
 * stamps `coalesce(orders.sent_at, orders.created_at)` when inserting
 * already-sent orders as `executed`).
 *
 * On current main, any INSERT that reaches the table can still mint an
 * `executed` action with `executed_at` null — a completed-action claim that
 * Activity / audit analysis cannot place in time. Writers normally INSERT
 * pre-execution statuses and only later UPDATE into `executed` with a
 * stamped timestamp, so those pre-execution inserts legitimately leave
 * `executed_at` null.
 *
 * This tip fails closed on INSERT when status claims `executed` without a
 * non-null `executed_at`. It does not restore table-level NOT NULL / CHECK
 * (that would block legitimate non-executed rows and failure UPDATEs),
 * rewrite supplier-send or decide_mise_action writers, or require
 * `executed_at` when status is still pre-execution or failed. Orthogonal to
 * mise_actions decision-actor tip (#1298), locale / ASCII-C pins, and
 * inventory / count-session / purchase-line actor tips.
 */

export type MiseActionExecutionStatus =
  | "prepared"
  | "waiting_for_approval"
  | "approved"
  | "rejected"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled"
  | "reversed"
  | "unverified";

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing execution-time evidence on insert.
 * Returns null when the status does not require executed_at, or when a
 * non-empty executed_at timestamp is present.
 */
export function validateMiseActionsExecutedAtEvidence(input: {
  status: MiseActionExecutionStatus | string | null | undefined;
  executedAt?: string | null;
}): string | null {
  if (input.status === "executed" && !hasTimestamp(input.executedAt)) {
    return "missing_executed_at";
  }
  return null;
}
