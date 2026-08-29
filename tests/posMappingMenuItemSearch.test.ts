import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPosMappingMenuItemsBySearch,
  POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD
} from "../services/domain/posMappingMenuItemSearch";

const menuItems = [
  { id: "mi-burger", name: "Classic Burger", category: "Mains" },
  { id: "mi-burger-deluxe", name: "Deluxe Burger", category: "Mains" },
  { id: "mi-fries", name: "Shoestring Fries", category: "Sides" },
  { id: "mi-salad", name: "Garden Salad", category: "Starters" },
  { id: "mi-cola", name: "House Cola", category: "Drinks" },
  { id: "mi-tea", name: "Iced Tea", category: "Drinks" },
  { id: "mi-soup", name: "Tomato Soup", category: "Starters" },
  { id: "mi-steak", name: "Ribeye Steak", category: "Mains" },
  { id: "mi-blank", name: "   ", category: "Other" }
] as const;

test("POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD stays at eight menu items", () => {
  assert.equal(POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD, 8);
});

test("filterPosMappingMenuItemsBySearch returns the full deduped list for an empty query", () => {
  const withDup = [
    ...menuItems.slice(0, 3),
    { id: "mi-burger", name: "Classic Burger Dup", category: "Mains" }
  ];
  assert.deepEqual(
    filterPosMappingMenuItemsBySearch(withDup, " ").map((item) => item.id),
    ["mi-burger", "mi-burger-deluxe", "mi-fries"]
  );
  assert.equal(filterPosMappingMenuItemsBySearch(menuItems, "").length, 9);
});

test("filterPosMappingMenuItemsBySearch ranks menu item name matches", () => {
  assert.deepEqual(
    filterPosMappingMenuItemsBySearch(menuItems, "burger").map((item) => item.id),
    ["mi-burger", "mi-burger-deluxe"]
  );
  assert.equal(filterPosMappingMenuItemsBySearch(menuItems, "ribeye")[0]?.id, "mi-steak");
  assert.deepEqual(filterPosMappingMenuItemsBySearch(menuItems, "missing-dish"), []);
});

test("filterPosMappingMenuItemsBySearch matches category text", () => {
  assert.deepEqual(
    filterPosMappingMenuItemsBySearch(menuItems, "drinks").map((item) => item.id),
    ["mi-cola", "mi-tea"]
  );
  assert.deepEqual(
    filterPosMappingMenuItemsBySearch(menuItems, "sides").map((item) => item.id),
    ["mi-fries"]
  );
});

test("filterPosMappingMenuItemsBySearch skips blank names and prefers exact/prefix hits", () => {
  assert.ok(!filterPosMappingMenuItemsBySearch(menuItems, "other").some((item) => item.id === "mi-blank"));
  assert.equal(
    filterPosMappingMenuItemsBySearch(menuItems, "classic burger")[0]?.id,
    "mi-burger"
  );
  assert.equal(
    filterPosMappingMenuItemsBySearch(menuItems, "deluxe")[0]?.id,
    "mi-burger-deluxe"
  );
});
