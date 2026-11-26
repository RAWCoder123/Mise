/**
 * Audit evidence required for inventory correction ledger reason codes.
 *
 * Hosted `record_inventory_event` already accepts correction for
 * owner/admin/manager and projects signed deltas onto on-hand. Without a
 * bounded reason taxonomy, a manager JWT can rewrite stock under correction
 * semantics with missing or free-form reasons that cannot be compared for
 * correction analysis or Activity provenance.
 *
 * Allowlist matches the product writers that surface corrections in UI
 * (#345 waste correction, #350 receipt correction):
 *   waste_correction | receipt_correction
 *
 * Notes, source allowlisting, supersede linkage, and exact-reverse quantity
 * contracts stay with their own tips. Receipt, count, waste, stockout, usage,
 * adjustment, and transfer keep their own evidence rules.
 */

export const INVENTORY_CORRECTION_REASON_CODES = [
  "waste_correction",
  "receipt_correction"
] as const;

export type InventoryCorrectionReasonCode =
  (typeof INVENTORY_CORRECTION_REASON_CODES)[number];

export function isInventoryCorrectionReasonCode(
  value: unknown
): value is InventoryCorrectionReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_CORRECTION_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Domain rejection reason for correction reason gaps.
 * Returns null when evidence is complete or the event is not a correction.
 */
export function validateCorrectionReasonEvidence(input: {
  eventType: string;
  reasonCode: string | null;
}): string | null {
  if (input.eventType !== "correction") return null;

  if (input.reasonCode == null || input.reasonCode.trim() === "") {
    return "correction_requires_reason";
  }
  if (!isInventoryCorrectionReasonCode(input.reasonCode.trim())) {
    return "invalid_correction_reason";
  }
  return null;
}
