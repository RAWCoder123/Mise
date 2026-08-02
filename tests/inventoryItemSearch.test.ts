import assert from "node:assert/strict";
import test from "node:test";

import {
  filterMenuItemsForPicker,
  resolveInventoryItemForRecipeLink,
  searchInventoryItemsForPicker
} from "../services/domain/inventoryItemSearch";

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
    supplier_name: "Local Farm",
    unit: "lb"
  },
  {
    id: "inv-roma",
    item_name: "Roma Tomatoes",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "lb"
  },
  {
    id: "inv-cherry",
    item_name: "Cherry Tomatoes",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "lb"
  }
] as const;

test("empty inventory search returns a stable alphabetical preview", () => {
  const matches = searchInventoryItemsForPicker(items, "  ", { limit: 3 });
  assert.deepEqual(
    matches.map((match) => match.item.item_name),
    ["Cherry Tomatoes", "Chicken Thighs", "Jasmine Rice"]
  );
  assert.equal(matches.every((match) => match.score === 0), true);
});

test("inventory search ranks exact, prefix, and substring matches", () => {
  const exact = searchInventoryItemsForPicker(items, "roma tomatoes");
  assert.equal(exact[0]?.item.id, "inv-roma");
  assert.equal(exact[0]?.exact, true);

  const prefix = searchInventoryItemsForPicker(items, "jas");
  assert.equal(prefix[0]?.item.id, "inv-rice");
  assert.ok((prefix[0]?.score ?? 0) >= 800);

  const substring = searchInventoryItemsForPicker(items, "tomato");
  assert.deepEqual(
    substring.map((match) => match.item.id),
    ["inv-cherry", "inv-roma"]
  );
});

test("inventory search matches category and supplier when name does not", () => {
  const bySupplier = searchInventoryItemsForPicker(items, "sysco");
  assert.equal(bySupplier.length, 1);
  assert.equal(bySupplier[0]?.item.id, "inv-chicken");

  const byCategory = searchInventoryItemsForPicker(items, "produce");
  assert.ok(byCategory.some((match) => match.item.id === "inv-roma"));
  assert.ok(byCategory.some((match) => match.item.id === "inv-cherry"));
});

test("resolveInventoryItemForRecipeLink prefers explicit id, then exact name, then unique hit", () => {
  assert.equal(
    resolveInventoryItemForRecipeLink(items, "tomatoes", "inv-cherry")?.id,
    "inv-cherry"
  );
  assert.equal(resolveInventoryItemForRecipeLink(items, "  Chicken   Thighs ")?.id, "inv-chicken");
  assert.equal(resolveInventoryItemForRecipeLink(items, "jas")?.id, "inv-rice");
  assert.equal(resolveInventoryItemForRecipeLink(items, "tomato"), null);
  assert.equal(resolveInventoryItemForRecipeLink(items, ""), null);
});

test("filterMenuItemsForPicker filters unmapped POS dishes by query", () => {
  const menuItems = ["Chicken Bowl", "Tofu Bowl", "Chicken Sandwich", "Caesar Salad"];
  assert.deepEqual(filterMenuItemsForPicker(menuItems, "", 2), ["Chicken Bowl", "Tofu Bowl"]);
  assert.deepEqual(filterMenuItemsForPicker(menuItems, "chicken"), ["Chicken Bowl", "Chicken Sandwich"]);
  assert.deepEqual(filterMenuItemsForPicker(menuItems, "salad"), ["Caesar Salad"]);
});
