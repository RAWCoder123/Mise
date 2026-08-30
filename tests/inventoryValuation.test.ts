import assert from "node:assert/strict";
import test from "node:test";

import {
  computeInventoryValuation,
  estimateInventoryDollarsAtRisk
} from "../services/domain/inventoryValuation";
import type { InventoryItem, InventoryOutlookItem, InventoryPrediction } from "../types/mise";

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "id" | "item_name">): InventoryItem {
  return {
    restaurant_id: "r1",
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 4,
    supplier_id: "sup-1",
    supplier_name: "Fresh",
    last_updated: "2026-08-30T12:00:00.000Z",
    ...partial
  };
}

function prediction(partial: Partial<InventoryPrediction> = {}): InventoryPrediction {
  return {
    projectedQuantity: 10,
    projectedStatus: "Good",
    daysCoverage: 3,
    averageDailyUsage: 3,
    todayDepletion: 0,
    unattributedTodayDepletion: 0,
    suggestedOrderQuantity: 0,
    demandTrend: "normal",
    historySource: "restaurant_history",
    historySampleDays: 14,
    coverageLabel: "About 3 days",
    confidenceCopy: "Based on 14 service days",
    suggestedAction: "Hold",
    whyItMatters: "Coverage is aligned",
    recommendationCopy: "No order needed",
    trendLabel: "Steady",
    urgency: "medium",
    basis: "history",
    depletionCopy: "",
    countEvidence: "verified_count",
    countedAt: "2026-08-30T08:00:00.000Z",
    countAgeHours: 4,
    countFreshness: "fresh",
    isTemporallyAuthoritative: true,
    ...partial
  };
}

function outlook(
  inventory: InventoryItem,
  projection: Partial<InventoryPrediction> = {}
): InventoryOutlookItem {
  return { item: inventory, prediction: prediction(projection) };
}

test("computeInventoryValuation sums projected on-hand value for priced items only", () => {
  const summary = computeInventoryValuation([
    outlook(item({ id: "a", item_name: "Chicken", estimated_unit_cost: 5, current_quantity: 8 }), {
      projectedQuantity: 6
    }),
    outlook(item({ id: "b", item_name: "Herbs", estimated_unit_cost: 0 }), {
      projectedQuantity: 2
    }),
    outlook(item({ id: "c", item_name: "Oil", estimated_unit_cost: 3, current_quantity: 4 }), {
      projectedQuantity: 4
    })
  ]);

  assert.equal(summary.itemCount, 3);
  assert.equal(summary.pricedItemCount, 2);
  assert.equal(summary.unpricedItemCount, 1);
  assert.equal(summary.costCoverageComplete, false);
  assert.equal(summary.onHandValue, 6 * 5 + 4 * 3);
});

test("computeInventoryValuation returns null on-hand value when no unit costs exist", () => {
  const summary = computeInventoryValuation([
    outlook(item({ id: "a", item_name: "Chicken", estimated_unit_cost: 0 }), {
      projectedQuantity: 10
    })
  ]);

  assert.equal(summary.onHandValue, null);
  assert.equal(summary.atRiskValue, null);
  assert.equal(summary.pricedItemCount, 0);
});

test("estimateInventoryDollarsAtRisk uses shortfall-to-par for Critical and Low items", () => {
  const critical = outlook(
    item({
      id: "a",
      item_name: "Chicken",
      estimated_unit_cost: 4,
      par_level: 20,
      current_quantity: 2
    }),
    { projectedQuantity: 2, projectedStatus: "Critical" }
  );
  const low = outlook(
    item({
      id: "b",
      item_name: "Onions",
      estimated_unit_cost: 2,
      par_level: 10,
      current_quantity: 3
    }),
    { projectedQuantity: 3, projectedStatus: "Low" }
  );
  const good = outlook(
    item({ id: "c", item_name: "Rice", estimated_unit_cost: 1, par_level: 50, current_quantity: 40 }),
    { projectedQuantity: 40, projectedStatus: "Good" }
  );

  const summary = computeInventoryValuation([critical, low, good]);
  assert.equal(summary.atRiskItemCount, 2);
  // Chicken: shortfall 18 * $4 = 72; Onions: shortfall 7 * $2 = 14
  assert.equal(summary.atRiskValue, 86);
  assert.equal(estimateInventoryDollarsAtRisk([critical, low, good]), 86);
});

test("estimateInventoryDollarsAtRisk ignores unpriced at-risk items without inventing dollars", () => {
  const summary = computeInventoryValuation([
    outlook(
      item({ id: "a", item_name: "Chicken", estimated_unit_cost: 0, par_level: 20, current_quantity: 1 }),
      { projectedQuantity: 1, projectedStatus: "Critical" }
    )
  ]);

  assert.equal(summary.atRiskItemCount, 1);
  assert.equal(summary.atRiskValue, null);
  assert.equal(estimateInventoryDollarsAtRisk([
    outlook(
      item({ id: "a", item_name: "Chicken", estimated_unit_cost: 0, par_level: 20, current_quantity: 1 }),
      { projectedQuantity: 1, projectedStatus: "Critical" }
    )
  ]), null);
});

test("empty outlooks produce an empty valuation summary", () => {
  assert.deepEqual(computeInventoryValuation([]), {
    itemCount: 0,
    pricedItemCount: 0,
    unpricedItemCount: 0,
    onHandValue: null,
    costCoverageComplete: false,
    atRiskItemCount: 0,
    atRiskValue: null
  });
  assert.equal(estimateInventoryDollarsAtRisk(null), null);
});
