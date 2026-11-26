/**
 * Structural audit evidence for inventory ledger actor attribution.
 *
 * `inventory_events.actor_user_id` was originally NOT NULL. Account-deletion
 * anonymization (`ON DELETE SET NULL` + append-only UPDATE escape) later made
 * the column nullable so historical rows can keep every business field while
 * clearing only the deleted operator's auth identity.
 *
 * Hosted `public.record_inventory_event` stamps `auth.uid()`, and count-session
 * approval stamps a validated `p_actor_user_id`. On current main, however, any
 * insert path that reaches the table (service_role, outbox replay helpers, or
 * future writers) can mint an append-only ledger row that rewrites on-hand
 * with `actor_user_id = null` — an unattributable stock change that Activity /
 * audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `actor_user_id` is null. It does not
 * restore a table-level NOT NULL / CHECK (that would break auth anonymization
 * UPDATEs), rewrite history, or change the append-only mutation escape.
 */

/**
 * Domain rejection reason for missing actor attribution on accept.
 * Returns null when a non-empty actor id is present.
 */
export function validateActorUserIdEvidence(input: {
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
