/**
 * Structural audit evidence for Mise-action decision actor attribution.
 *
 * `mise_actions.approved_by` is nullable so account-deletion anonymization can
 * clear only the deleted operator's auth identity while preserving the
 * action's operational history (`ON DELETE SET NULL`). Hosted
 * `public.decide_mise_action` stamps `auth.uid()` into `approved_by` via
 * UPDATE for both approve and reject decisions.
 *
 * On current main, any INSERT that reaches the table can still mint an
 * `approved` or `rejected` action with `approved_by` null — an
 * unattributable decision that Activity / audit analysis cannot pin to an
 * operator. Writers normally INSERT `prepared` / `waiting_for_approval` and
 * only later UPDATE into a decision status, so those pre-decision inserts
 * legitimately leave `approved_by` null.
 *
 * This tip fails closed on INSERT when status claims a decision without a
 * non-null `approved_by`. It does not restore table-level NOT NULL / CHECK
 * (that would block auth anonymization UPDATEs), rewrite decide_mise_action,
 * or require `approved_by` when status is still pre-decision. Orthogonal to
 * domain ASCII-C approvedBy identity (#800), mise_actions locale pins, and
 * inventory / count-session / purchase-line actor tips.
 */

export type MiseActionDecisionStatus =
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

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing decision-actor attribution on insert.
 * Returns null when the status does not require a decision actor, or when a
 * non-empty approved_by id is present.
 */
export function validateMiseActionsDecisionActorEvidence(input: {
  status: MiseActionDecisionStatus | string | null | undefined;
  approvedBy?: string | null;
}): string | null {
  if (input.status === "approved" && !hasActor(input.approvedBy)) {
    return "missing_approved_by";
  }
  if (input.status === "rejected" && !hasActor(input.approvedBy)) {
    return "missing_approved_by";
  }
  return null;
}
