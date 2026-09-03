/**
 * Manager inventory usage events record known consumption that is not waste
 * (prep draw-down, staff meals, tasting, training). Quantity is always a
 * positive amount subtracted from on-hand; signed corrections belong to the
 * dedicated adjustment flow.
 */

export const INVENTORY_USAGE_REASON_CODES = [
  "prep",
  "staff_meal",
  "tasting",
  "training",
  "other"
] as const;

export type InventoryUsageReasonCode = (typeof INVENTORY_USAGE_REASON_CODES)[number];

export function isInventoryUsageReasonCode(value: unknown): value is InventoryUsageReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_USAGE_REASON_CODES as readonly string[]).includes(value)
  );
}
