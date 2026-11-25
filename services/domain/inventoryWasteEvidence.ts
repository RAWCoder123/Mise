/**
 * Audit evidence required for inventory waste ledger events.
 *
 * Hosted `record_inventory_event` already accepts waste for owner/admin/manager
 * and projects it onto on-hand. Without a bounded reason taxonomy, a manager JWT
 * can rewrite stock under waste semantics with free-form or missing reasons that
 * cannot be compared for waste analysis or purchasing learning.
 *
 * Allowlist matches the product writer that surfaces waste reasons in UI
 * (#301 / #1098): spoilage | prep_trim | overproduction | dropped_broken |
 * expired | other. Notes stay optional. Receipt, count, stockout, usage,
 * adjustment, transfer, and correction keep their own evidence rules.
 */

export const INVENTORY_WASTE_REASON_CODES = [
  "spoilage",
  "prep_trim",
  "overproduction",
  "dropped_broken",
  "expired",
  "other"
] as const;

export type InventoryWasteReasonCode = (typeof INVENTORY_WASTE_REASON_CODES)[number];

export function isInventoryWasteReasonCode(
  value: unknown
): value is InventoryWasteReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_WASTE_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Domain rejection reason for waste evidence gaps.
 * Returns null when evidence is complete or the event is not waste.
 */
export function validateWasteEvidence(input: {
  eventType: string;
  reasonCode: string | null;
}): string | null {
  if (input.eventType !== "waste") return null;

  if (input.reasonCode == null || input.reasonCode.trim() === "") {
    return "waste_requires_reason";
  }
  if (!isInventoryWasteReasonCode(input.reasonCode.trim())) {
    return "invalid_waste_reason";
  }
  return null;
}
