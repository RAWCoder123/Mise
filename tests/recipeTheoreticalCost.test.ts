import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  DEMO_RESTAURANT_TIME_ZONE
} from "../services/demoData";
import { buildRecipeBaselineSummary } from "../services/domain/miseDomain";
import { computeRecipeTheoreticalFoodCost } from "../services/domain/recipeTheoreticalCost";
import { toDateKeyInTimeZone } from "../utils/format";

function demoOperatingDate() {
  return toDateKeyInTimeZone(new Date(), DEMO_RESTAURANT_TIME_ZONE);
}

test("computeRecipeTheoreticalFoodCost sums qty × estimated_unit_cost when all costs are positive", () => {
  const result = computeRecipeTheoreticalFoodCost(
    [
      { inventoryItemId: "a", quantityUsedPerSale: 0.5 },
      { inventoryItemId: "b", quantityUsedPerSale: 2 }
    ],
    [
      { id: "a", estimated_unit_cost: 4 },
      { id: "b", estimated_unit_cost: 1.25 }
    ]
  );

  assert.equal(result.status, "complete");
  assert.equal(result.amount, 4.5);
  assert.equal(result.pricedIngredientCount, 2);
  assert.equal(result.missingCostIngredientCount, 0);
  assert.equal(result.ingredientCount, 2);
});

test("computeRecipeTheoreticalFoodCost marks incomplete when any unit cost is missing or ≤ 0", () => {
  const missing = computeRecipeTheoreticalFoodCost(
    [
      { inventoryItemId: "a", quantityUsedPerSale: 1 },
      { inventoryItemId: "b", quantityUsedPerSale: 1 }
    ],
    [{ id: "a", estimated_unit_cost: 3 }]
  );
  assert.equal(missing.status, "incomplete");
  assert.equal(missing.amount, 3);
  assert.equal(missing.pricedIngredientCount, 1);
  assert.equal(missing.missingCostIngredientCount, 1);

  const zero = computeRecipeTheoreticalFoodCost(
    [{ inventoryItemId: "a", quantityUsedPerSale: 2 }],
    [{ id: "a", estimated_unit_cost: 0 }]
  );
  assert.equal(zero.status, "incomplete");
  assert.equal(zero.amount, null);
  assert.equal(zero.missingCostIngredientCount, 1);

  const negative = computeRecipeTheoreticalFoodCost(
    [{ inventoryItemId: "a", quantityUsedPerSale: 1 }],
    [{ id: "a", estimated_unit_cost: -2 }]
  );
  assert.equal(negative.status, "incomplete");
  assert.equal(negative.amount, null);
});

test("computeRecipeTheoreticalFoodCost returns empty for dishes with no ingredients", () => {
  const result = computeRecipeTheoreticalFoodCost([], [{ id: "a", estimated_unit_cost: 4 }]);
  assert.equal(result.status, "empty");
  assert.equal(result.amount, null);
  assert.equal(result.ingredientCount, 0);
});

test("computeRecipeTheoreticalFoodCost rounds currency to cents", () => {
  const result = computeRecipeTheoreticalFoodCost(
    [{ inventoryItemId: "a", quantityUsedPerSale: 1 / 3 }],
    [{ id: "a", estimated_unit_cost: 1 }]
  );
  assert.equal(result.status, "complete");
  assert.equal(result.amount, 0.33);
});

test("buildRecipeBaselineSummary attaches theoretical food cost from inventory unit costs", () => {
  const state = createInitialDemoState("Toast");
  const summary = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate()
  );

  const chickenBowl = summary.items.find((item) => item.menu_item_name === "Chicken Bowl");
  assert.ok(chickenBowl?.theoreticalFoodCost);
  assert.ok(
    chickenBowl.theoreticalFoodCost.status === "complete" ||
      chickenBowl.theoreticalFoodCost.status === "incomplete"
  );
  assert.equal(chickenBowl.theoreticalFoodCost.ingredientCount, chickenBowl.ingredientCount);

  if (chickenBowl.theoreticalFoodCost.status === "complete") {
    assert.ok(chickenBowl.theoreticalFoodCost.amount !== null);
    assert.ok(chickenBowl.theoreticalFoodCost.amount > 0);
  }
});
