/**
 * Structural audit evidence for activity-event user-actor attribution.
 *
 * `activity_events.actor_user_id` is nullable so:
 * - `mise` / `system` / `integration` actors can leave it null, and
 * - account-deletion anonymization can clear only the deleted operator's
 *   auth identity while preserving the activity's operational history
 *   (`ON DELETE SET NULL` + the append-only UPDATE escape in
 *   `private.reject_immutable_operational_record_mutation`).
 *
 * Hosted `private.append_activity_event` forwards `p_actor_type` and
 * `p_actor_user_id` without requiring them to agree. On current main, any
 * INSERT that reaches the table can still mint `actor_type = 'user'` with
 * `actor_user_id` null — an unattributable human action that Activity /
 * audit analysis cannot pin to an operator.
 *
 * This tip fails closed on INSERT when `actor_type` claims a user without a
 * non-null `actor_user_id`. It does not restore a tighter table-level CHECK /
 * NOT NULL (that would block auth anonymization UPDATEs), rewrite
 * append_activity_event, or require an actor when the event is attributed to
 * mise / system / integration. Orthogonal to activity resolution-actor tip
 * (#1300), activity locale / ASCII-C pins, and inventory / purchase-line /
 * mise-action actor tips.
 */

export type ActivityActorType = "mise" | "user" | "integration" | "system";

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing user-actor attribution on insert.
 * Returns null when the actor type does not require a user id, or when a
 * non-empty actor_user_id accompanies actor_type = 'user'.
 */
export function validateActivityUserActorEvidence(input: {
  actorType?: ActivityActorType | string | null;
  actorUserId?: string | null;
}): string | null {
  if (input.actorType === "user" && !hasActor(input.actorUserId)) {
    return "missing_actor_user_id";
  }
  return null;
}
