import type { InventoryItem } from "../../types/mise";

/**
 * Inventory items default to active. Missing/`undefined` active (pre-migration
 * fixtures and older demo rows) is treated as active so planning stays open
 * until an explicit deactivate.
 */
export function isActiveInventoryItem(
  item: Pick<InventoryItem, "active"> | null | undefined
): boolean {
  if (!item) return false;
  return item.active !== false;
}
