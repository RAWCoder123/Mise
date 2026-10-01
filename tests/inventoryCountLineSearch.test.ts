import assert from "node:assert/strict";
import test from "node:test";

import {
  filterInventoryCountLinesBySearch,
  INVENTORY_COUNT_LINE_SEARCH_THRESHOLD
} from "../services/domain/inventoryCountLineSearch";

const lines = [
  {
    id: "line-chicken",
    inventory_item_id: "inv-chicken",
    item_name: "Chicken Thighs",
    unit: "lb"
  },
  {
    id: "line-rice",
    inventory_item_id: "inv-rice",
    item_name: "Jasmine Rice",
    unit: "lb"
  },
  {
    id: "line-roma",
    inventory_item_id: "inv-roma",
    item_name: "Roma Tomatoes",
    unit: "case"
  },
  {
    id: "line-cherry",
    inventory_item_id: "inv-cherry",
    item_name: "Cherry Tomatoes",
    unit: "pint"
  },
  {
    id: "line-lettuce",
    inventory_item_id: "inv-lettuce",
    item_name: "Romaine Lettuce",
    unit: "head"
  },
  {
    id: "line-oil",
    inventory_item_id: "inv-oil",
    item_name: "Olive Oil",
    unit: "gal"
  },
  {
    id: "line-salt",
    inventory_item_id: "inv-salt",
    item_name: "Kosher Salt",
    unit: "lb"
  },
  {
    id: "line-pepper",
    inventory_item_id: "inv-pepper",
    item_name: "Black Pepper",
    unit: "oz"
  },
  {
    id: "line-flour",
    inventory_item_id: "inv-flour",
    item_name: "All-Purpose Flour",
    unit: "lb"
  }
] as const;

test("INVENTORY_COUNT_LINE_SEARCH_THRESHOLD stays at eight lines", () => {
  assert.equal(INVENTORY_COUNT_LINE_SEARCH_THRESHOLD, 8);
});

test("filterInventoryCountLinesBySearch returns the full list for an empty query", () => {
  assert.deepEqual(
    filterInventoryCountLinesBySearch(lines, " ").map((line) => line.inventory_item_id),
    lines.map((line) => line.inventory_item_id)
  );
  assert.equal(filterInventoryCountLinesBySearch(lines, "").length, 9);
});

test("filterInventoryCountLinesBySearch ranks prefix and substring name matches", () => {
  assert.deepEqual(
    filterInventoryCountLinesBySearch(lines, "tomato").map((line) => line.inventory_item_id),
    ["inv-roma", "inv-cherry"]
  );
  assert.equal(filterInventoryCountLinesBySearch(lines, "jas")[0]?.inventory_item_id, "inv-rice");
  assert.equal(
    filterInventoryCountLinesBySearch(lines, "chicken thighs")[0]?.inventory_item_id,
    "inv-chicken"
  );
  assert.deepEqual(filterInventoryCountLinesBySearch(lines, "tofu"), []);
});

test("filterInventoryCountLinesBySearch matches unit labels", () => {
  const pints = filterInventoryCountLinesBySearch(lines, "pint").map(
    (line) => line.inventory_item_id
  );
  assert.deepEqual(pints, ["inv-cherry"]);
});

test("filterInventoryCountLinesBySearch dedupes blank inventory item ids", () => {
  const messy = [
    { id: "line-a", inventory_item_id: "inv-a", item_name: "A" },
    { id: "line-a2", inventory_item_id: "inv-a", item_name: "A duplicate" },
    { id: "line-blank", inventory_item_id: "  ", item_name: "Blank" },
    { id: "line-b", inventory_item_id: "inv-b", item_name: "B" }
  ];
  assert.deepEqual(
    filterInventoryCountLinesBySearch(messy, "").map((line) => line.inventory_item_id),
    ["inv-a", "inv-b"]
  );
});
