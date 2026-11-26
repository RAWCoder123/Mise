/**
 * Structural audit evidence for purchase-decision actor attribution.
 *
 * `purchase_decision_events.actor_user_id` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving every append-only business field (`ON DELETE SET NULL` + the
 * append-only UPDATE escape in `private.reject_purchase_decision_event_mutation`).
 *
 * Hosted `private.record_purchase_decision_base_event` and
 * `private.record_purchase_decision_compensation` stamp `auth.uid()`. On
 * current main, every other insert path that reaches the table (including
 * direct service_role / superuser inserts that satisfy the existing soft
 * CHECKs) can mint an append-only approve, dismiss, undo, or exclusion row
 * with `actor_user_id = null` — unattributable learning evidence that
 * pattern aggregation / Activity / audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `actor_user_id` is null. It does not
 * restore a table-level NOT NULL / CHECK (that would block auth
 * anonymization UPDATEs), rewrite history, or change the append-only
 * mutation escape. Orthogonal to inventory actor attribution (#1280),
 * purchase-line recorder attribution (#1292), and purchase-decision locale
 * pins.
 */

/**
 * Domain rejection reason for missing actor attribution on accept.
 * Returns null when a non-empty actor id is present.
 */
export function validatePurchaseDecisionActorUserIdEvidence(input: {
  actorUserId: string | null | undefined;
}): string | null {
  if (typeof input.actorUserId !== "string") {
    return "missing_actor_user_id";
  }
  if (!input.actorUserId.trim()) {
    return "missing_actor_user_id";
  }
  return null;
}
