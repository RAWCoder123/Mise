import assert from "node:assert/strict";
import test from "node:test";

import {
  filterRecipeBaselineItemsBySearch,
  RECIPE_BASELINE_SEARCH_THRESHOLD
} from "../services/domain/recipeBaselineSearch";
import { buildRecipeBaselineSummary } from "../services/domain/miseDomain";
import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  DEMO_RESTAURANT_TIME_ZONE
} from "../services/demoData";
import { toDateKeyInTimeZone } from "../utils/format";

function demoOperatingDate(now = new Date()) {
  return toDateKeyInTimeZone(now, DEMO_RESTAURANT_TIME_ZONE);
}

test("RECIPE_BASELINE_SEARCH_THRESHOLD stays at five dishes", () => {
  assert.equal(RECIPE_BASELINE_SEARCH_THRESHOLD, 5);
});

test("filterRecipeBaselineItemsBySearch ranks dishes and linked ingredients", () => {
  const dishes = [
    {
      menu_item_name: "Chicken Bowl",
      linkedInventoryItems: ["Chicken breast", "Rice"],
      ingredients: [{ itemName: "Chicken breast" }, { itemName: "Rice" }]
    },
    {
      menu_item_name: "Veggie Bowl",
      linkedInventoryItems: ["Tomatoes", "Jasmine rice"],
      ingredients: [{ itemName: "Tomatoes" }, { itemName: "Jasmine rice" }]
    },
    {
      menu_item_name: "Tomato Soup",
      linkedInventoryItems: ["Tomatoes"],
      ingredients: [{ itemName: "Tomatoes" }]
    }
  ];

  assert.deepEqual(
    filterRecipeBaselineItemsBySearch(dishes, " ").map((item) => item.menu_item_name),
    ["Chicken Bowl", "Veggie Bowl", "Tomato Soup"]
  );

  assert.deepEqual(
    filterRecipeBaselineItemsBySearch(dishes, "bowl").map((item) => item.menu_item_name),
    ["Chicken Bowl", "Veggie Bowl"]
  );

  assert.deepEqual(
    filterRecipeBaselineItemsBySearch(dishes, "jasmine").map((item) => item.menu_item_name),
    ["Veggie Bowl"]
  );

  assert.deepEqual(
    filterRecipeBaselineItemsBySearch(dishes, "tomato").map((item) => item.menu_item_name),
    ["Tomato Soup", "Veggie Bowl"]
  );
});

test("recipe baseline summary defaults to six items and can return the full settings list", () => {
  const state = createInitialDemoState("Toast");
  const tomatoes = state.inventoryItems.find((item) => item.item_name === "Tomatoes");
  assert.ok(tomatoes);

  for (let index = 0; index < 4; index += 1) {
    state.menuItemIngredients.push({
      id: `mapping_extra_${index}`,
      restaurant_id: DEMO_RESTAURANT_ID,
      menu_item_name: `Extra Dish ${index + 1}`,
      inventory_item_id: tomatoes.id,
      quantity_used_per_sale: 0.1,
      unit: tomatoes.unit
    });
  }

  const compact = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate()
  );
  assert.ok(compact.menuItemsTracked >= 7);
  assert.equal(compact.items.length, 6);

  const full = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate(),
    [],
    { itemLimit: null }
  );
  assert.equal(full.items.length, full.menuItemsTracked);
  assert.ok(full.items.length > 6);
  assert.ok(full.items.some((item) => item.menu_item_name === "Extra Dish 1"));
});
