/**
 * Structural audit evidence for inventory ledger reason codes.
 *
 * Hosted `public.record_inventory_event` already accepts a free-text
 * `p_reason_code` for owner/admin/manager. On current main, any non-empty
 * string can be stamped onto the append-only ledger — including spaces,
 * punctuation, mixed case, and one-off free-form phrases that cannot be
 * compared for Activity / reason-code analysis.
 *
 * Operational mode changes already require the same slug shape
 * (`^[a-z0-9_]{3,64}$` in `enforce_emergency_operational_mode`). Product
 * writers that stamp inventory reasons use lowercase snake_case codes of
 * that form (waste, stockout, transfer, correction allowlists).
 *
 * This tip fails closed when a reason_code is present and does not match
 * that slug. Null / blank (trimmed empty) remains allowed so event types
 * that omit a reason stay unconstrained. Event-type allowlists, other-note
 * requirements, and length-only bounds stay with their own tips.
 */

/** Same slug shape as private.operational_mode_changes / emergency controls. */
export const INVENTORY_REASON_CODE_SLUG_PATTERN = /^[a-z0-9_]{3,64}$/;

export function isInventoryReasonCodeSlug(value: unknown): boolean {
  return typeof value === "string" && INVENTORY_REASON_CODE_SLUG_PATTERN.test(value);
}

/**
 * Domain rejection reason for non-slug reason codes.
 * Returns null when the code is absent/blank or already a valid slug.
 */
export function validateReasonCodeSlugEvidence(input: {
  reasonCode: string | null;
}): string | null {
  if (input.reasonCode == null) return null;
  const trimmed = input.reasonCode.trim();
  if (trimmed === "") return null;
  if (!isInventoryReasonCodeSlug(trimmed)) {
    return "invalid_reason_code_shape";
  }
  return null;
}
