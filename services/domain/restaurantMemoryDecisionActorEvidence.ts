/**
 * Structural audit evidence for restaurant-memory decision actor attribution.
 *
 * `restaurant_memories.corrected_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the memory's operational history (`ON DELETE SET NULL`). Hosted
 * `public.update_restaurant_memory` stamps `auth.uid()` into `corrected_by`
 * via UPDATE for confirmed, corrected, dismissed, forgotten, and disabled
 * decisions.
 *
 * On current main, any INSERT that reaches the table can still mint a
 * decision-status memory with `corrected_by` null — an unattributable
 * manager decision that Activity / audit analysis cannot pin to an operator.
 * Writers normally INSERT `active` learned patterns and only later UPDATE
 * into a decision status, so those pre-decision inserts legitimately leave
 * `corrected_by` null.
 *
 * This tip fails closed on INSERT when status claims a memory decision
 * without a non-null `corrected_by`. It does not restore table-level
 * NOT NULL / CHECK (that would block auth anonymization UPDATEs), rewrite
 * update_restaurant_memory, or require `corrected_by` when status is still
 * `active`. Orthogonal to restaurant-memory locale / ASCII-C pins and
 * inventory / purchase-line / mise-action actor tips.
 */

export type RestaurantMemoryDecisionStatus =
  | "active"
  | "confirmed"
  | "corrected"
  | "dismissed"
  | "forgotten"
  | "disabled";

const DECISION_STATUSES = new Set<string>([
  "confirmed",
  "corrected",
  "dismissed",
  "forgotten",
  "disabled",
]);

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing decision-actor attribution on insert.
 * Returns null when the status does not require a decision actor, or when a
 * non-empty corrected_by id is present.
 */
export function validateRestaurantMemoryDecisionActorEvidence(input: {
  status: RestaurantMemoryDecisionStatus | string | null | undefined;
  correctedBy?: string | null;
}): string | null {
  if (DECISION_STATUSES.has(String(input.status ?? "")) && !hasActor(input.correctedBy)) {
    return "missing_corrected_by";
  }
  return null;
}
