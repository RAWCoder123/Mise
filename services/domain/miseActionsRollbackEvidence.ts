/**
 * Structural audit evidence for Mise-action reversal attribution.
 *
 * `mise_actions.rollback_reference` is nullable because non-reversed statuses
 * (`prepared`, `waiting_for_approval`, `approved`, `executed`, `failed`, …)
 * legitimately leave it null. Domain `markReversed` already requires a
 * non-empty rollback reference when advancing an action to `reversed`, but
 * on current main any INSERT that reaches the table can still mint a
 * `reversed` action with `rollback_reference` null — a terminal reversal
 * claim that Activity / audit analysis cannot explain.
 *
 * Writers normally INSERT pre-execution or executed statuses and only later
 * UPDATE into `reversed` with a stamped rollback reference, so those
 * pre-reversal inserts legitimately leave the field null.
 *
 * This tip fails closed on INSERT when status claims `reversed` without a
 * non-empty `rollback_reference`. It does not restore table-level NOT NULL /
 * status-implies-reference CHECK (that would block legitimate non-reversed
 * rows), rewrite `decide_mise_action` / failure writers, or require a
 * rollback reference when status is still pre-reversal. Orthogonal to
 * mise_actions executed_at tip (#1304), failure-evidence tip (#1305),
 * decision-actor tip (#1298), locale / ASCII-C pins (including
 * rollback_reference cntrl / ASCII-C pins), and actor tips #1280–#1303.
 */

export type MiseActionRollbackStatus =
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

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing rollback evidence on insert.
 * Returns null when the status does not require a rollback reference, or when
 * a non-empty rollback_reference is present.
 */
export function validateMiseActionsRollbackEvidence(input: {
  status: MiseActionRollbackStatus | string | null | undefined;
  rollbackReference?: string | null;
}): string | null {
  if (input.status !== "reversed") {
    return null;
  }
  if (!hasText(input.rollbackReference)) {
    return "missing_rollback_reference";
  }
  return null;
}
