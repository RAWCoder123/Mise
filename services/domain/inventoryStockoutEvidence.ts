/**
 * Audit evidence required for inventory stockout ledger events.
 *
 * Hosted `record_inventory_event` already accepts stockout for owner/admin/manager
 * and projects on-hand to zero. Without a bounded reason taxonomy, a manager JWT
 * can rewrite stock under stockout semantics with free-form or missing reasons that
 * cannot be compared for coverage learning or purchasing analysis.
 *
 * Allowlist matches the product writer that surfaces stockout reasons in UI
 * (#366): under_ordered | unexpected_demand | delivery_missed | spoilage_cleared |
 * theft_loss | other. Notes stay optional. Receipt, count, waste, usage,
 * adjustment, transfer, and correction keep their own evidence rules.
 */

export const INVENTORY_STOCKOUT_REASON_CODES = [
  "under_ordered",
  "unexpected_demand",
  "delivery_missed",
  "spoilage_cleared",
  "theft_loss",
  "other"
] as const;

export type InventoryStockoutReasonCode =
  (typeof INVENTORY_STOCKOUT_REASON_CODES)[number];

export function isInventoryStockoutReasonCode(
  value: unknown
): value is InventoryStockoutReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_STOCKOUT_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Domain rejection reason for stockout evidence gaps.
 * Returns null when evidence is complete or the event is not stockout.
 */
export function validateStockoutEvidence(input: {
  eventType: string;
  reasonCode: string | null;
}): string | null {
  if (input.eventType !== "stockout") return null;

  if (input.reasonCode == null || input.reasonCode.trim() === "") {
    return "stockout_requires_reason";
  }
  if (!isInventoryStockoutReasonCode(input.reasonCode.trim())) {
    return "invalid_stockout_reason";
  }
  return null;
}
