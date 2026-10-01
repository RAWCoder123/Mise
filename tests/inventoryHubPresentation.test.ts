import assert from "node:assert/strict";
import test from "node:test";

import {
  isInventoryCanonicalUnitReady,
  listNeedsVerificationOutlooks,
  matchesInventoryHubFilter
} from "../services/presentation/inventoryHubPresentation";
import type { InventoryItem, InventoryOutlookItem, InventoryPrediction } from "../types/mise";

function item(
  id: string,
  overrides: Partial<
    Pick<InventoryItem, "canonical_unit" | "canonical_unit_verification_status" | "item_name">
  > = {}
): InventoryItem {
  return {
    id,
    restaurant_id: "restaurant-a",
    item_name: overrides.item_name ?? id,
    category: "Produce",
    unit: "case",
    current_quantity: 4,
    par_level: 6,
    reorder_threshold: 3,
    supplier_id: "supplier-a",
    supplier_name: "Green Farm",
    estimated_unit_cost: 12,
    last_updated: "2026-08-31T12:00:00.000Z",
    canonical_unit: overrides.canonical_unit === undefined ? "g" : overrides.canonical_unit,
    canonical_quantity_per_unit: 1000,
    canonical_unit_verification_status: overrides.canonical_unit_verification_status ?? "verified"
  };
}

function prediction(
  status: InventoryPrediction["projectedStatus"]
): InventoryPrediction {
  return {
    averageDailyUsage: 2,
    historySampleDays: 14,
    historySource: "restaurant_history",
    todayDepletion: 1,
    projectedQuantity: 4,
    projectedStatus: status,
    daysCoverage: 2,
    coverageLabel: "2 days",
    demandTrend: "normal",
    trendLabel: "Normal",
    suggestedOrderQuantity: 0,
    suggestedAction: "Hold",
    urgency: "low",
    basis: "Mapped POS demand",
    depletionCopy: "Stable",
    confidenceCopy: "Based on 14 service days",
    recommendationCopy: "No reorder needed",
    whyItMatters: "Coverage is healthy.",
    countEvidence: "verified_count",
    countedAt: "2026-08-31T08:00:00.000Z",
    countAgeHours: 4,
    countFreshness: "fresh",
    unattributedTodayDepletion: 0,
    isTemporallyAuthoritative: true
  };
}

function outlook(
  inventoryItem: InventoryItem,
  status: InventoryPrediction["projectedStatus"] = "Good"
): InventoryOutlookItem {
  return { item: inventoryItem, prediction: prediction(status) };
}

test("isInventoryCanonicalUnitReady requires verified g/ml/each", () => {
  assert.equal(isInventoryCanonicalUnitReady(item("ok")), true);
  assert.equal(
    isInventoryCanonicalUnitReady(item("draft", { canonical_unit_verification_status: "draft" })),
    false
  );
  assert.equal(
    isInventoryCanonicalUnitReady(item("rejected", { canonical_unit_verification_status: "rejected" })),
    false
  );
  assert.equal(
    isInventoryCanonicalUnitReady(
      item("expired", { canonical_unit_verification_status: "expired" })
    ),
    false
  );
  assert.equal(isInventoryCanonicalUnitReady(item("missing-unit", { canonical_unit: null })), false);
});

test("matchesInventoryHubFilter keeps stock filters and isolates needs verification", () => {
  const verifiedLow = outlook(item("verified-low"), "Low");
  const unverifiedGood = outlook(
    item("unverified", { canonical_unit_verification_status: "draft" }),
    "Good"
  );

  assert.equal(matchesInventoryHubFilter(verifiedLow, "All"), true);
  assert.equal(matchesInventoryHubFilter(verifiedLow, "At risk"), true);
  assert.equal(matchesInventoryHubFilter(verifiedLow, "Good"), false);
  assert.equal(matchesInventoryHubFilter(verifiedLow, "Needs verification"), false);

  assert.equal(matchesInventoryHubFilter(unverifiedGood, "All"), true);
  assert.equal(matchesInventoryHubFilter(unverifiedGood, "Good"), true);
  assert.equal(matchesInventoryHubFilter(unverifiedGood, "At risk"), false);
  assert.equal(matchesInventoryHubFilter(unverifiedGood, "Needs verification"), true);
});

test("listNeedsVerificationOutlooks returns only unverified items and respects limit", () => {
  const rows = [
    outlook(item("a", { canonical_unit_verification_status: "draft" }), "Watch"),
    outlook(item("b"), "Critical"),
    outlook(item("c", { canonical_unit_verification_status: "rejected" }), "Good"),
    outlook(item("d", { canonical_unit: null }), "Low")
  ];

  assert.deepEqual(
    listNeedsVerificationOutlooks(rows).map((row) => row.item.id),
    ["a", "c", "d"]
  );
  assert.deepEqual(
    listNeedsVerificationOutlooks(rows, 2).map((row) => row.item.id),
    ["a", "c"]
  );
});
