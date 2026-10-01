/**
 * Manager inventory adjustments are signed ledger deltas that do not supersede
 * another event. They explain on-hand changes that are not a count, receipt,
 * waste, or stockout (found stock, unexplained loss after investigation, etc.).
 *
 * Corrections that reverse a specific waste row belong to the dedicated waste
 * correction flow. Adjustments never set supersedesEventId.
 */

export const INVENTORY_ADJUSTMENT_REASON_CODES = [
  "found",
  "lost",
  "recount_delta",
  "other"
] as const;

export type InventoryAdjustmentReasonCode = (typeof INVENTORY_ADJUSTMENT_REASON_CODES)[number];

export type InventoryAdjustmentDirection = "increase" | "decrease";

export function isInventoryAdjustmentReasonCode(
  value: unknown
): value is InventoryAdjustmentReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_ADJUSTMENT_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Convert a positive magnitude and direction into the signed ledger quantity.
 * Zero and non-finite magnitudes fail closed.
 */
export function signedAdjustmentQuantity(
  magnitude: number,
  direction: InventoryAdjustmentDirection
): number | null {
  if (!Number.isFinite(magnitude) || magnitude <= 0) return null;
  return direction === "decrease" ? -magnitude : magnitude;
}

export function adjustmentDirectionFromSignedQuantity(
  quantity: number
): InventoryAdjustmentDirection | null {
  if (!Number.isFinite(quantity) || quantity === 0) return null;
  return quantity < 0 ? "decrease" : "increase";
}
