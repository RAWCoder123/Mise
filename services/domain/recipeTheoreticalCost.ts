import type { InventoryItem, RecipeBaselineIngredient, RecipeTheoreticalFoodCost } from "../../types/mise";

/**
 * Theoretical dish food cost from mapped baseline quantities × estimated unit cost.
 * Incomplete when any ingredient lacks a positive finite unit cost — never invents prices.
 */
export function computeRecipeTheoreticalFoodCost(
  ingredients: readonly Pick<RecipeBaselineIngredient, "inventoryItemId" | "quantityUsedPerSale">[],
  inventoryItems: readonly Pick<InventoryItem, "id" | "estimated_unit_cost">[]
): RecipeTheoreticalFoodCost {
  if (ingredients.length === 0) {
    return {
      status: "empty",
      amount: null,
      pricedIngredientCount: 0,
      missingCostIngredientCount: 0,
      ingredientCount: 0
    };
  }

  const costByItemId = new Map(
    inventoryItems.map((item) => [item.id, item.estimated_unit_cost] as const)
  );

  let amount = 0;
  let pricedIngredientCount = 0;
  let missingCostIngredientCount = 0;

  for (const ingredient of ingredients) {
    const quantity = ingredient.quantityUsedPerSale;
    const unitCost = costByItemId.get(ingredient.inventoryItemId);
    const quantityValid = Number.isFinite(quantity) && quantity >= 0;
    const costValid = unitCost !== undefined && Number.isFinite(unitCost) && unitCost > 0;

    if (!quantityValid || !costValid) {
      missingCostIngredientCount += 1;
      continue;
    }

    amount += quantity * unitCost;
    pricedIngredientCount += 1;
  }

  if (missingCostIngredientCount > 0) {
    return {
      status: "incomplete",
      amount: pricedIngredientCount > 0 ? roundCurrency(amount) : null,
      pricedIngredientCount,
      missingCostIngredientCount,
      ingredientCount: ingredients.length
    };
  }

  return {
    status: "complete",
    amount: roundCurrency(amount),
    pricedIngredientCount,
    missingCostIngredientCount: 0,
    ingredientCount: ingredients.length
  };
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
