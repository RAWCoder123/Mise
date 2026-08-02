import assert from "node:assert/strict";
import test from "node:test";

import {
  filterInventoryItemsBySearch,
  filterMenuItemsForPicker,
  filterRecipeBaselineItemsBySearch,
  filterStorageLocationsBySearch,
  filterSupplierOrdersBySearch,
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

test("filterInventoryItemsBySearch preserves order when empty and ranks full lists", () => {
  const empty = filterInventoryItemsBySearch(items, " ");
  assert.deepEqual(
    empty.map((item) => item.id),
    ["inv-chicken", "inv-rice", "inv-roma", "inv-cherry"]
  );

  const tomatoes = filterInventoryItemsBySearch(items, "tomato");
  assert.deepEqual(
    tomatoes.map((item) => item.id),
    ["inv-cherry", "inv-roma"]
  );

  const byExtra = filterInventoryItemsBySearch(items, "run out today", {
    getExtraSearchText: (item) =>
      item.id === "inv-roma" ? "May run out today" : "Likely enough for several days"
  });
  assert.deepEqual(
    byExtra.map((item) => item.id),
    ["inv-roma"]
  );
});

const locations = [
  { id: "loc-main", name: "Main" },
  { id: "loc-walk", name: "Walk-in Cooler" },
  { id: "loc-line", name: "Line Fridge" },
  { id: "loc-dry", name: "Dry Storage" },
  { id: "loc-bar", name: "Bar Cooler" },
  { id: "loc-prep", name: "Prep Fridge" }
] as const;

test("filterStorageLocationsBySearch ranks matches and pins selected when unmatched", () => {
  const empty = filterStorageLocationsBySearch(locations, " ");
  assert.deepEqual(
    empty.map((location) => location.id),
    ["loc-main", "loc-walk", "loc-line", "loc-dry", "loc-bar", "loc-prep"]
  );

  const coolers = filterStorageLocationsBySearch(locations, "cooler");
  assert.deepEqual(
    coolers.map((location) => location.id),
    ["loc-bar", "loc-walk"]
  );

  const pinned = filterStorageLocationsBySearch(locations, "prep", {
    selectedId: "loc-main"
  });
  assert.deepEqual(
    pinned.map((location) => location.id),
    ["loc-main", "loc-prep"]
  );

  const selectedMatch = filterStorageLocationsBySearch(locations, "fridge", {
    selectedId: "loc-line"
  });
  assert.equal(selectedMatch[0]?.id, "loc-line");
  assert.ok(selectedMatch.some((location) => location.id === "loc-prep"));
});

const recipeBaselines = [
  {
    menu_item_name: "Chicken Bowl",
    linkedInventoryItems: ["Chicken Thighs", "Jasmine Rice"],
    ingredients: [{ itemName: "Chicken Thighs" }, { itemName: "Jasmine Rice" }]
  },
  {
    menu_item_name: "Tomato Salad",
    linkedInventoryItems: ["Roma Tomatoes"],
    ingredients: [{ itemName: "Roma Tomatoes" }]
  },
  {
    menu_item_name: "Tofu Bowl",
    linkedInventoryItems: ["Firm Tofu", "Jasmine Rice"],
    ingredients: [{ itemName: "Firm Tofu" }, { itemName: "Jasmine Rice" }]
  },
  {
    menu_item_name: "Caesar Salad",
    linkedInventoryItems: ["Romaine", "Parmesan"],
    ingredients: [{ itemName: "Romaine" }, { itemName: "Parmesan" }]
  },
  {
    menu_item_name: "Cherry Tomato Special",
    linkedInventoryItems: ["Cherry Tomatoes"],
    ingredients: [{ itemName: "Cherry Tomatoes" }]
  }
] as const;

test("filterRecipeBaselineItemsBySearch ranks dishes and linked ingredients", () => {
  const empty = filterRecipeBaselineItemsBySearch(recipeBaselines, " ");
  assert.deepEqual(
    empty.map((item) => item.menu_item_name),
    recipeBaselines.map((item) => item.menu_item_name)
  );

  const bowls = filterRecipeBaselineItemsBySearch(recipeBaselines, "bowl");
  assert.deepEqual(
    bowls.map((item) => item.menu_item_name),
    ["Chicken Bowl", "Tofu Bowl"]
  );

  const byIngredient = filterRecipeBaselineItemsBySearch(recipeBaselines, "jasmine");
  assert.deepEqual(
    byIngredient.map((item) => item.menu_item_name),
    ["Chicken Bowl", "Tofu Bowl"]
  );

  const tomatoes = filterRecipeBaselineItemsBySearch(recipeBaselines, "tomato");
  assert.deepEqual(
    tomatoes.map((item) => item.menu_item_name),
    ["Tomato Salad", "Cherry Tomato Special"]
  );
});

const supplierOrders = [
  {
    id: "ord-sysco",
    supplier_name: "Sysco Produce",
    order_message: "Tomatoes x12\nLettuce x6",
    operator_note: "Deliver before lunch"
  },
  {
    id: "ord-farm",
    supplier_name: "Local Farm",
    order_message: "Chicken thighs 20 lb",
    operator_note: null
  },
  {
    id: "ord-dairy",
    supplier_name: "Dairy Direct",
    order_message: "Cream and butter",
    operator_note: "Ask for cold pack"
  },
  {
    id: "ord-sysco-dry",
    supplier_name: "Sysco Dry Goods",
    order_message: "Rice and oil",
    operator_note: "Weekly standing"
  },
  {
    id: "ord-seafood",
    supplier_name: "Harbor Seafood",
    order_message: "Salmon portions",
    operator_note: "Hold if late"
  }
] as const;

test("filterSupplierOrdersBySearch ranks supplier, message, and note matches", () => {
  const empty = filterSupplierOrdersBySearch(supplierOrders, " ");
  assert.deepEqual(
    empty.map((order) => order.id),
    supplierOrders.map((order) => order.id)
  );

  const sysco = filterSupplierOrdersBySearch(supplierOrders, "sysco");
  assert.deepEqual(
    sysco.map((order) => order.id),
    ["ord-sysco-dry", "ord-sysco"]
  );

  const byMessage = filterSupplierOrdersBySearch(supplierOrders, "chicken");
  assert.deepEqual(
    byMessage.map((order) => order.id),
    ["ord-farm"]
  );

  const byNote = filterSupplierOrdersBySearch(supplierOrders, "cold pack");
  assert.deepEqual(
    byNote.map((order) => order.id),
    ["ord-dairy"]
  );
});
