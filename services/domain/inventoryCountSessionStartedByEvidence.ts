/**
 * Structural audit evidence for inventory count-session starter attribution.
 *
 * `inventory_count_sessions.started_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the session's operational history (`ON DELETE SET NULL`).
 *
 * Hosted `private.service_begin_inventory_count_session` stamps
 * `p_actor_user_id` into `started_by`. On current main, every other insert
 * path that reaches the table (including direct service_role / superuser
 * inserts that satisfy the existing soft CHECKs) can mint a count session
 * with `started_by = null` — an unattributable physical-count workflow that
 * Activity / audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `started_by` is null. It does not
 * restore a table-level NOT NULL / CHECK (that would block auth
 * anonymization UPDATEs), rewrite begin/submit/approve/cancel writers, or
 * require submitted_by / approved_by / cancelled_by at insert time (those
 * are legitimately null until later workflow steps). Orthogonal to inventory
 * actor attribution (#1280), count-session provenance on ledger rows (#393),
 * scoped cycle sessions (#1107), and approve_count_session source authority
 * (#1262).
 */

/**
 * Domain rejection reason for missing starter attribution on accept.
 * Returns null when a non-empty starter id is present.
 */
export function validateInventoryCountSessionStartedByEvidence(input: {
  startedBy: string | null | undefined;
}): string | null {
  if (typeof input.startedBy !== "string") {
    return "missing_started_by";
  }
  if (!input.startedBy.trim()) {
    return "missing_started_by";
  }
  return null;
}
