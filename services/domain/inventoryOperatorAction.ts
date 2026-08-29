/**
 * Inventory detail ledger actions. Query-param deep links may request one;
 * unknown or missing values fail closed to count.
 */

export const INVENTORY_OPERATOR_ACTIONS = ["count", "receipt", "waste", "stockout"] as const;

export type InventoryOperatorAction = (typeof INVENTORY_OPERATOR_ACTIONS)[number];

export function parseInventoryOperatorAction(
  value: string | null | undefined
): InventoryOperatorAction {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if ((INVENTORY_OPERATOR_ACTIONS as readonly string[]).includes(normalized)) {
    return normalized as InventoryOperatorAction;
  }
  return "count";
}
