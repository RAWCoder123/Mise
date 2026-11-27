/**
 * Structural audit evidence for audit-log actor attribution.
 *
 * `audit_logs.actor_user_id` is nullable so account-deletion anonymization can
 * clear only the deleted operator's auth identity while preserving the audit
 * row's operational history (`ON DELETE SET NULL`). There is intentionally no
 * table-level NOT NULL / CHECK that forces an actor on every row, because that
 * would block the FK anonymization UPDATE.
 *
 * Hosted `private.service_record_edge_audit_log` already rejects a null
 * `p_actor_user_id`. On current main, any other INSERT that reaches the table
 * (including direct service_role inserts that satisfy soft CHECKs and RLS
 * bypass) can still mint an audit row with `actor_user_id = null` — an
 * unattributable sensitive-action record that audit browse / compliance
 * analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `actor_user_id` is absent. It does not
 * restore table-level NOT NULL / CHECK (that would block auth anonymization
 * UPDATEs) or rewrite `service_record_edge_audit_log`. Orthogonal to audit_logs
 * ASCII-C / cntrl locale pins and inventory / purchase-line / activity actor
 * tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing actor attribution on insert.
 * Returns null when a non-empty actor_user_id is present.
 */
export function validateAuditLogActorEvidence(input: {
  actorUserId?: string | null;
}): string | null {
  if (!hasActor(input.actorUserId)) {
    return "missing_actor_user_id";
  }
  return null;
}
