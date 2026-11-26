/**
 * Structural audit evidence for operational-finding decision actor attribution.
 *
 * `operational_finding_decisions.actor_user_id` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving every append-only business field (`ON DELETE SET NULL` + the
 * append-only UPDATE escape in
 * `private.reject_operational_finding_decision_mutation`).
 *
 * Hosted `public.record_operational_finding_decision` stamps `auth.uid()`. On
 * current main, every other insert path that reaches the table (including
 * direct service_role / superuser inserts that satisfy the existing soft
 * CHECKs) can mint an append-only approve, edit, or dismiss row with
 * `actor_user_id = null` — unattributable finding-feedback evidence that
 * learning / Activity / audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `actor_user_id` is null. It does not
 * restore a table-level NOT NULL / CHECK (that would block auth
 * anonymization UPDATEs), rewrite history, or change the append-only
 * mutation escape. Orthogonal to inventory actor attribution (#1280),
 * purchase-line recorder attribution (#1292), purchase-decision actor
 * attribution (#1293), and finding-decision ASCII-C response pins.
 */

/**
 * Domain rejection reason for missing actor attribution on accept.
 * Returns null when a non-empty actor id is present.
 */
export function validateOperationalFindingDecisionActorUserIdEvidence(input: {
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
