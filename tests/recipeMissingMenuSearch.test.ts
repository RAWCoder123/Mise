import assert from "node:assert/strict";
import test from "node:test";

import {
  filterMissingMenuItemsBySearch,
  RECIPE_MISSING_MENU_SEARCH_THRESHOLD
} from "../services/domain/recipeMissingMenuSearch";

test("RECIPE_MISSING_MENU_SEARCH_THRESHOLD stays at five dishes", () => {
  assert.equal(RECIPE_MISSING_MENU_SEARCH_THRESHOLD, 5);
});

test("filterMissingMenuItemsBySearch returns the full list for an empty query", () => {
  const missing = [
    "Chicken Bowl",
    "Veggie Bowl",
    "Tomato Soup",
    "Caesar Salad",
    "Fish Tacos",
    "Burger"
  ];

  assert.deepEqual(filterMissingMenuItemsBySearch(missing, " "), missing);
  assert.deepEqual(filterMissingMenuItemsBySearch(missing, ""), missing);
  assert.equal(filterMissingMenuItemsBySearch(missing, "").length, 6);
});

test("filterMissingMenuItemsBySearch ranks prefix and substring matches", () => {
  const missing = ["Chicken Bowl", "Veggie Bowl", "Tomato Soup", "Chicken Wrap"];

  assert.deepEqual(filterMissingMenuItemsBySearch(missing, "bowl"), ["Chicken Bowl", "Veggie Bowl"]);
  assert.deepEqual(filterMissingMenuItemsBySearch(missing, "chicken"), ["Chicken Bowl", "Chicken Wrap"]);
  assert.deepEqual(filterMissingMenuItemsBySearch(missing, "tomato soup"), ["Tomato Soup"]);
  assert.deepEqual(filterMissingMenuItemsBySearch(missing, "taco"), []);
});

test("filterMissingMenuItemsBySearch dedupes blank and case-equivalent names", () => {
  const missing = ["  Chicken Bowl  ", "chicken bowl", "", "Veggie Bowl", "   "];

  assert.deepEqual(filterMissingMenuItemsBySearch(missing, ""), ["Chicken Bowl", "Veggie Bowl"]);
  assert.deepEqual(filterMissingMenuItemsBySearch(missing, "chicken"), ["Chicken Bowl"]);
});
