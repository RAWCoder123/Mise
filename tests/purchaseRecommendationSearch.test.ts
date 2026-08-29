import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPurchaseRecommendationsBySearch,
  PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD
} from "../services/domain/purchaseRecommendationSearch";

const recommendations = [
  {
    id: "rec-tomato",
    item_name: "Roma Tomatoes",
    supplier_name: "Sysco Produce",
    reason: "Below par before weekend service",
    unit: "case"
  },
  {
    id: "rec-chicken",
    item_name: "Chicken Thighs",
    supplier_name: "Local Farm",
    reason: "Projected stockout Friday",
    unit: "lb"
  },
  {
    id: "rec-cream",
    item_name: "Heavy Cream",
    supplier_name: "Dairy Direct",
    reason: "Par coverage under three days",
    unit: "qt"
  },
  {
    id: "rec-rice",
    item_name: "Jasmine Rice",
    supplier_name: "Sysco Dry Goods",
    reason: "Standing weekly restock",
    unit: "bag"
  },
  {
    id: "rec-salmon",
    item_name: "Salmon Portions",
    supplier_name: "Harbor Seafood",
    reason: "High usage after brunch special",
    unit: "lb"
  }
] as const;

test("PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD stays at five recommendations", () => {
  assert.equal(PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD, 5);
});

test("filterPurchaseRecommendationsBySearch returns the full list for an empty query", () => {
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, " ").map(
      (recommendation) => recommendation.id
    ),
    recommendations.map((recommendation) => recommendation.id)
  );
  assert.equal(filterPurchaseRecommendationsBySearch(recommendations, "").length, 5);
});

test("filterPurchaseRecommendationsBySearch ranks item name matches", () => {
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, "chicken").map(
      (recommendation) => recommendation.id
    ),
    ["rec-chicken"]
  );
  assert.equal(
    filterPurchaseRecommendationsBySearch(recommendations, "roma")[0]?.id,
    "rec-tomato"
  );
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, "missing-sku"),
    []
  );
});

test("filterPurchaseRecommendationsBySearch matches supplier names", () => {
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, "sysco").map(
      (recommendation) => recommendation.id
    ),
    ["rec-tomato", "rec-rice"]
  );
  assert.equal(
    filterPurchaseRecommendationsBySearch(recommendations, "harbor")[0]?.id,
    "rec-salmon"
  );
});

test("filterPurchaseRecommendationsBySearch matches reason and unit text", () => {
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, "brunch").map(
      (recommendation) => recommendation.id
    ),
    ["rec-salmon"]
  );
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, "case").map(
      (recommendation) => recommendation.id
    ),
    ["rec-tomato"]
  );
  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(recommendations, "stockout").map(
      (recommendation) => recommendation.id
    ),
    ["rec-chicken"]
  );
});

test("filterPurchaseRecommendationsBySearch prefers item hits over supplier hits", () => {
  const mixed = [
    {
      id: "rec-item-sysco",
      item_name: "Sysco Blend Oil",
      supplier_name: "Local Farm",
      reason: "Low stock",
      unit: "gal"
    },
    {
      id: "rec-supplier-sysco",
      item_name: "Paper Towels",
      supplier_name: "Sysco Dry Goods",
      reason: "Par restock",
      unit: "case"
    }
  ] as const;

  assert.deepEqual(
    filterPurchaseRecommendationsBySearch(mixed, "sysco").map(
      (recommendation) => recommendation.id
    ),
    ["rec-item-sysco", "rec-supplier-sysco"]
  );
});
