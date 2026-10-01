import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { filterLogDeliveryInventoryBySearch } from "../services/domain/logDeliveryInventorySearch";

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
    id: "inv-lettuce",
    item_name: "Romaine Lettuce",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "head"
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
  },
  {
    id: "inv-pepper",
    item_name: "Black Pepper",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "oz"
  },
  {
    id: "inv-flour",
    item_name: "All-Purpose Flour",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "lb"
  },
  {
    id: "inv-butter",
    item_name: "Unsalted Butter",
    category: "Dairy",
    supplier_name: "Sysco",
    unit: "lb"
  },
  {
    id: "inv-cream",
    item_name: "Heavy Cream",
    category: "Dairy",
    supplier_name: "Sysco",
    unit: "qt"
  },
  {
    id: "inv-eggs",
    item_name: "Large Eggs",
    category: "Dairy",
    supplier_name: "Local Farm",
    unit: "dozen"
  },
  {
    id: "inv-milk",
    item_name: "Whole Milk",
    category: "Dairy",
    supplier_name: "Sysco",
    unit: "gal"
  },
  {
    id: "inv-sugar",
    item_name: "Granulated Sugar",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "lb"
  },
  {
    id: "inv-yeast",
    item_name: "Active Dry Yeast",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "oz"
  },
  {
    id: "inv-basil",
    item_name: "Fresh Basil",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "bunch"
  },
  {
    id: "inv-onion",
    item_name: "Yellow Onion",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "lb"
  },
  {
    id: "inv-garlic",
    item_name: "Garlic",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "lb"
  },
  {
    id: "inv-shrimp",
    item_name: "Gulf Shrimp",
    category: "Protein",
    supplier_name: "Seafood Co",
    unit: "lb"
  },
  {
    id: "inv-salmon",
    item_name: "Atlantic Salmon",
    category: "Protein",
    supplier_name: "Seafood Co",
    unit: "lb"
  },
  {
    id: "inv-bacon",
    item_name: "Smoked Bacon",
    category: "Protein",
    supplier_name: "Sysco",
    unit: "lb"
  },
  {
    id: "inv-pasta",
    item_name: "Spaghetti Pasta",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "lb"
  },
  {
    id: "inv-stock",
    item_name: "Chicken Stock",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "qt"
  },
  {
    id: "inv-cheese",
    item_name: "Parmesan Cheese",
    category: "Dairy",
    supplier_name: "Sysco",
    unit: "lb"
  },
  {
    id: "inv-lemon",
    item_name: "Lemons",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "case"
  },
  {
    id: "inv-lime",
    item_name: "Limes",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "case"
  },
  {
    id: "inv-cilantro",
    item_name: "Cilantro",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "bunch"
  },
  {
    id: "inv-avocado",
    item_name: "Hass Avocado",
    category: "Produce",
    supplier_name: "Local Farm",
    unit: "case"
  },
  {
    id: "inv-bread",
    item_name: "Sourdough Bread",
    category: "Bakery",
    supplier_name: "Bakery Co",
    unit: "loaf"
  },
  {
    id: "inv-wine",
    item_name: "Cooking Wine",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "btl"
  },
  {
    id: "inv-vinegar",
    item_name: "Red Wine Vinegar",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "btl"
  },
  {
    id: "inv-soy",
    item_name: "Soy Sauce",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "btl"
  },
  {
    id: "inv-honey",
    item_name: "Wildflower Honey",
    category: "Dry Goods",
    supplier_name: "Local Farm",
    unit: "jar"
  },
  {
    id: "inv-mustard",
    item_name: "Dijon Mustard",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "jar"
  },
  {
    id: "inv-mayo",
    item_name: "Mayonnaise",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "jar"
  },
  {
    id: "inv-ketchup",
    item_name: "Ketchup",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "btl"
  },
  {
    id: "inv-pickle",
    item_name: "Dill Pickles",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "jar"
  },
  {
    id: "inv-capers",
    item_name: "Capers",
    category: "Dry Goods",
    supplier_name: "Sysco",
    unit: "jar"
  },
  {
    id: "inv-olives",
    item_name: "Kalamata Olives",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "jar"
  },
  {
    id: "inv-anchovy",
    item_name: "Anchovy Fillets",
    category: "Protein",
    supplier_name: "Seafood Co",
    unit: "tin"
  },
  {
    id: "inv-tuna",
    item_name: "Canned Tuna",
    category: "Protein",
    supplier_name: "Seafood Co",
    unit: "can"
  },
  {
    id: "inv-beans",
    item_name: "Cannellini Beans",
    category: "Dry Goods",
    supplier_name: "Restaurant Depot",
    unit: "can"
  }
] as const;

test("filterLogDeliveryInventoryBySearch returns the full uncapped list for an empty query", () => {
  assert.equal(items.length, 42);
  assert.equal(filterLogDeliveryInventoryBySearch(items, "").length, 42);
  assert.equal(filterLogDeliveryInventoryBySearch(items, "   ").length, 42);
  assert.deepEqual(
    filterLogDeliveryInventoryBySearch(items, " ").map((item) => item.id),
    items.map((item) => item.id)
  );
});

test("filterLogDeliveryInventoryBySearch does not soft-cap past forty matches", () => {
  const produce = filterLogDeliveryInventoryBySearch(items, "local farm");
  assert.ok(produce.length > 10);
  assert.equal(
    filterLogDeliveryInventoryBySearch(items, "").length,
    42,
    "browse list must stay uncapped beyond the former soft-cap of 40"
  );
});

test("filterLogDeliveryInventoryBySearch ranks prefix and substring name matches", () => {
  assert.deepEqual(
    filterLogDeliveryInventoryBySearch(items, "tomato").map((item) => item.id),
    ["inv-roma", "inv-cherry"]
  );
  assert.equal(filterLogDeliveryInventoryBySearch(items, "jas")[0]?.id, "inv-rice");
  assert.equal(filterLogDeliveryInventoryBySearch(items, "chicken thighs")[0]?.id, "inv-chicken");
  assert.deepEqual(filterLogDeliveryInventoryBySearch(items, "tofu"), []);
});

test("filterLogDeliveryInventoryBySearch matches id, category, supplier, and unit", () => {
  assert.equal(filterLogDeliveryInventoryBySearch(items, "inv-salmon")[0]?.id, "inv-salmon");
  assert.ok(filterLogDeliveryInventoryBySearch(items, "dairy").every((item) => item.category === "Dairy"));
  assert.ok(
    filterLogDeliveryInventoryBySearch(items, "seafood co").every(
      (item) => item.supplier_name === "Seafood Co"
    )
  );
  assert.deepEqual(
    filterLogDeliveryInventoryBySearch(items, "pint").map((item) => item.id),
    ["inv-cherry"]
  );
});

test("filterLogDeliveryInventoryBySearch dedupes blank ids and preserves first occurrence", () => {
  const messy = [
    { id: "inv-a", item_name: "A" },
    { id: "", item_name: "Blank" },
    { id: "inv-a", item_name: "A Duplicate" },
    { id: "inv-b", item_name: "B" }
  ];
  assert.deepEqual(
    filterLogDeliveryInventoryBySearch(messy, "").map((item) => item.id),
    ["inv-a", "inv-b"]
  );
});

test("Log Delivery inventory list uses ranked search without a soft-cap of forty", () => {
  const screen = readFileSync("app/more/log-delivery.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(screen, /filterLogDeliveryInventoryBySearch/);
  assert.match(screen, /logDelivery\.search\.showing/);
  assert.doesNotMatch(screen, /\.slice\(0,\s*40\)/);
  assert.match(catalog, /"logDelivery\.search\.showing"/);
  assert.match(catalog, /"logDelivery\.allItems"/);
  assert.match(catalog, /"logDelivery\.results"/);
});
