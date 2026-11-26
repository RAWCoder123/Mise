/**
 * Structural audit evidence for inventory ledger sources.
 *
 * Hosted `public.record_inventory_event` already requires a non-empty
 * `p_source` for owner/admin/manager. On current main, any 1–80 character
 * string can be stamped onto the append-only ledger — including spaces,
 * punctuation, mixed case, and one-off free-form phrases that cannot be
 * compared for Activity / write-path provenance analysis.
 *
 * Product writers stamp lowercase snake_case sources
 * (`operator_receipt`, `supplier_delivery`, `approve_count_session`, …).
 * Event-type allowlists constrain which of those labels are valid per type;
 * this tip only requires the comparable slug shape so free-form provenance
 * cannot bypass those allowlists once they land, and so unconstrained event
 * types on current main still get a durable shape gate.
 *
 * This tip fails closed when `source` does not match
 * `^[a-z0-9_]{3,80}$` (3–80 matches the column length ceiling). Empty /
 * whitespace-only sources remain `missing_source` from the existing
 * accept path. Event-type allowlists, mise/session forgery guards, and
 * length-only bounds stay with their own tips.
 */

/** Lowercase snake slug bounded by inventory_events.source length (≤80). */
export const INVENTORY_SOURCE_SLUG_PATTERN = /^[a-z0-9_]{3,80}$/;

export function isInventorySourceSlug(value: unknown): boolean {
  return typeof value === "string" && INVENTORY_SOURCE_SLUG_PATTERN.test(value);
}

/**
 * Domain rejection reason for non-slug sources.
 * Returns null when the source is already a valid slug.
 * Callers that see blank/whitespace should still surface `missing_source`
 * first; this helper treats blank as a shape failure only if reached.
 */
export function validateSourceSlugEvidence(input: {
  source: string;
}): string | null {
  if (!isInventorySourceSlug(input.source)) {
    return "invalid_source_shape";
  }
  return null;
}
