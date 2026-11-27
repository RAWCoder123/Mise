/**
 * Structural audit evidence for restaurant-memory decision-time attribution.
 *
 * `restaurant_memories.corrected_at` is nullable because pre-decision
 * `active` learned-pattern inserts legitimately leave it null. Hosted
 * `public.update_restaurant_memory` stamps `corrected_at = now()` via UPDATE
 * for confirmed, corrected, dismissed, forgotten, and disabled decisions
 * (alongside `corrected_by`).
 *
 * On current main, any INSERT that reaches the table can still mint a
 * decision-status memory with `corrected_at` null — a manager decision that
 * Activity / audit analysis cannot place in time. Writers normally INSERT
 * `active` learned patterns and only later UPDATE into a decision status, so
 * those pre-decision inserts legitimately leave `corrected_at` null.
 * Account-deletion anonymization clears `corrected_by` via
 * `ON DELETE SET NULL` but preserves `corrected_at`.
 *
 * This tip fails closed on INSERT when status claims a memory decision
 * without a non-null `corrected_at`. It does not restore table-level
 * NOT NULL / CHECK, rewrite update_restaurant_memory, or require
 * `corrected_at` when status is still `active`. Companion to the
 * decision-actor tip (#1299 / corrected_by); orthogonal to restaurant-memory
 * locale / ASCII-C pins and inventory / purchase-line / mise-action tips.
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

function hasTimestamp(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing decision-time attribution on insert.
 * Returns null when the status does not require a decision timestamp, or when
 * a non-empty corrected_at value is present.
 */
export function validateRestaurantMemoryDecisionTimeEvidence(input: {
  status: RestaurantMemoryDecisionStatus | string | null | undefined;
  correctedAt?: string | null;
}): string | null {
  if (
    DECISION_STATUSES.has(String(input.status ?? "")) &&
    !hasTimestamp(input.correctedAt)
  ) {
    return "missing_corrected_at";
  }
  return null;
}
