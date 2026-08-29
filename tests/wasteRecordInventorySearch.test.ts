import assert from "node:assert/strict";
import test from "node:test";

import { filterWasteRecordInventoryBySearch } from "../services/domain/wasteRecordInventorySearch";

const items = [
  {
    id: "inv-chicken",
    item_name: "Chicken Thighs",
    category: "Protein",
    supplier_name: "Sysco",
    unit: "lb"
  },
  {
    id: "inv-rice",
    item_name: "Jasmine Rice",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "lb"
  },
  {
    id: "inv-roma",
    item_name: "Roma Tomatoes",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "case"
  },
  {
    id: "inv-cherry",
    item_name: "Cherry Tomatoes",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "pint"
  },
  {
    id: "inv-oil",
    item_name: "Olive Oil",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "gal"
  },
  {
    id: "inv-salt",
    item_name: "Kosher Salt",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "lb"
  }
];

test("empty waste record query preserves caller order without soft-cap", () => {
  const ranked = filterWasteRecordInventoryBySearch(items, "  ");
  assert.deepEqual(
    ranked.map((item) => item.id),
    items.map((item) => item.id)
  );
});

test("waste record search ranks exact and prefix name matches first", () => {
  const ranked = filterWasteRecordInventoryBySearch(items, "roma");
  assert.equal(ranked[0]?.id, "inv-roma");
  assert.deepEqual(
    ranked.map((item) => item.id),
    ["inv-roma"]
  );

  const tomatoMatches = filterWasteRecordInventoryBySearch(items, "tomato");
  assert.equal(tomatoMatches[0]?.id, "inv-roma");
  assert.ok(tomatoMatches.some((item) => item.id === "inv-cherry"));
});

test("waste record search matches supplier and category without inventing rows", () => {
  const bySupplier = filterWasteRecordInventoryBySearch(items, "sysco");
  assert.deepEqual(
    bySupplier.map((item) => item.id).sort(),
    ["inv-chicken", "inv-oil", "inv-salt"].sort()
  );

  const byCategory = filterWasteRecordInventoryBySearch(items, "produce");
  assert.deepEqual(
    byCategory.map((item) => item.id).sort(),
    ["inv-cherry", "inv-roma"].sort()
  );

  assert.deepEqual(filterWasteRecordInventoryBySearch(items, "no-such-item"), []);
});

test("waste record search dedupes by id and ignores blank names for non-empty queries", () => {
  const withDupes = [
    ...items,
    { ...items[0]!, id: "inv-chicken" },
    { id: "inv-blank", item_name: "   ", category: "Other", supplier_name: "X", unit: "ea" }
  ];
  const ranked = filterWasteRecordInventoryBySearch(withDupes, "chicken");
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]?.id, "inv-chicken");
});
