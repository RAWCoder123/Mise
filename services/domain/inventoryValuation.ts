import type { InventoryItem } from "../../types/mise";

/**
 * Deterministic on-hand inventory valuation for a single restaurant.
 *
 * `current_quantity` and `estimated_unit_cost` share the item's purchase unit.
 * Items without a finite positive unit cost stay visible as incomplete rather
 * than inventing a zero value that looks like a finished total.
 */
export interface InventoryOnHandValuation {
  restaurantId: string;
  itemCount: number;
  pricedItemCount: number;
  unpricedItemCount: number;
  /** Rounded currency total when at least one priced item exists; otherwise null. */
  valuedOnHand: number | null;
  /** True only when every item in scope has a usable unit cost. */
  costComplete: boolean;
}

export function buildInventoryOnHandValuation(input: {
  restaurantId: string;
  items: readonly InventoryItem[];
}): InventoryOnHandValuation {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) {
    throw new Error("Inventory valuation requires a restaurant.");
  }

  let itemCount = 0;
  let pricedItemCount = 0;
  let unpricedItemCount = 0;
  let valuedOnHand = 0;
  let hasPricedValue = false;

  for (const item of input.items) {
    if (item.restaurant_id !== restaurantId) {
      throw new Error("Inventory valuation received cross-restaurant evidence.");
    }
    itemCount += 1;

    const quantity = Number(item.current_quantity);
    const unitCost = Number(item.estimated_unit_cost);
    const quantityUsable = Number.isFinite(quantity) && quantity >= 0;
    const costUsable = Number.isFinite(unitCost) && unitCost > 0;

    if (!quantityUsable || !costUsable) {
      unpricedItemCount += 1;
      continue;
    }

    pricedItemCount += 1;
    valuedOnHand += quantity * unitCost;
    hasPricedValue = true;
  }

  return {
    restaurantId,
    itemCount,
    pricedItemCount,
    unpricedItemCount,
    valuedOnHand: hasPricedValue ? roundCurrency(valuedOnHand) : null,
    costComplete: itemCount > 0 && unpricedItemCount === 0
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
