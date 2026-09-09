import assert from "node:assert/strict";
import test from "node:test";

import {
  filterInventoryItemsForRecipeBuilder,
  RECIPE_INVENTORY_CHIP_SEARCH_THRESHOLD
} from "../services/domain/recipeInventoryItemSearch";

const items = [
  {
    id: "inv-chicken",
    item_name: "Chicken Thighs",
    category: "Protein",
    supplier_name: "Sysco"
  },
  {
    id: "inv-rice",
    item_name: "Jasmine Rice",
    category: "Dry Goods",
    supplier_name: "Local Farm"
  },
  {
    id: "inv-roma",
    item_name: "Roma Tomatoes",
    category: "Produce",
    supplier_name: "Local Farm"
  },
  {
    id: "inv-cherry",
    item_name: "Cherry Tomatoes",
    category: "Produce",
    supplier_name: "Local Farm"
  },
  {
    id: "inv-lettuce",
    item_name: "Romaine Lettuce",
    category: "Produce",
    supplier_name: "Local Farm"
  },
  {
    id: "inv-oil",
    item_name: "Olive Oil",
    category: "Dry Goods",
    supplier_name: "Sysco"
  },
  {
    id: "inv-salt",
    item_name: "Kosher Salt",
    category: "Dry Goods",
    supplier_name: "Sysco"
  },
  {
    id: "inv-pepper",
    item_name: "Black Pepper",
    category: "Dry Goods",
    supplier_name: "Sysco"
  }
] as const;

test("RECIPE_INVENTORY_CHIP_SEARCH_THRESHOLD stays at seven items", () => {
  assert.equal(RECIPE_INVENTORY_CHIP_SEARCH_THRESHOLD, 7);
});

test("filterInventoryItemsForRecipeBuilder returns the full list for an empty query", () => {
  assert.deepEqual(
    filterInventoryItemsForRecipeBuilder(items, " ").map((item) => item.id),
    items.map((item) => item.id)
  );
  assert.equal(filterInventoryItemsForRecipeBuilder(items, "").length, 8);
});

test("filterInventoryItemsForRecipeBuilder ranks prefix and substring name matches", () => {
  assert.deepEqual(
    filterInventoryItemsForRecipeBuilder(items, "tomato").map((item) => item.id),
    ["inv-roma", "inv-cherry"]
  );
  assert.equal(filterInventoryItemsForRecipeBuilder(items, "jas")[0]?.id, "inv-rice");
  assert.equal(filterInventoryItemsForRecipeBuilder(items, "chicken thighs")[0]?.id, "inv-chicken");
  assert.deepEqual(filterInventoryItemsForRecipeBuilder(items, "tofu"), []);
});

test("filterInventoryItemsForRecipeBuilder matches category and supplier", () => {
  assert.equal(filterInventoryItemsForRecipeBuilder(items, "sysco")[0]?.id, "inv-chicken");
  const produce = filterInventoryItemsForRecipeBuilder(items, "produce").map((item) => item.id);
  assert.ok(produce.includes("inv-roma"));
  assert.ok(produce.includes("inv-cherry"));
  assert.ok(produce.includes("inv-lettuce"));
});

test("filterInventoryItemsForRecipeBuilder dedupes blank ids", () => {
  const messy = [
    { id: "inv-a", item_name: "A" },
    { id: "inv-a", item_name: "A duplicate" },
    { id: "  ", item_name: "Blank" },
    { id: "inv-b", item_name: "B" }
  ];
  assert.deepEqual(
    filterInventoryItemsForRecipeBuilder(messy, "").map((item) => item.id),
    ["inv-a", "inv-b"]
  );
});
