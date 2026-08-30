import assert from "node:assert/strict";
import { test } from "node:test";

import {
  learnedRecommendationReason,
  purchaseRecommendationPresentation,
  recommendationReason
} from "../services/domain/miseDomain";
import {
  presentPurchaseRecommendationReason,
  purchaseRecommendationReasonDescriptor
} from "../services/presentation/purchaseRecommendationPresentation";
import type { InventoryItem, InventoryPrediction, PurchaseRecommendation } from "../types/mise";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_1",
    restaurant_id: "rest_1",
    item_name: "Roma Tomatoes",
    category: "Produce",
    current_quantity: 4,
    unit: "lb",
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 1.5,
    supplier_id: "sup_1",
    supplier_name: "Local Produce Co",
    last_updated: "2026-08-30T00:00:00.000Z",
    ...overrides
  };
}

function prediction(overrides: Partial<InventoryPrediction> = {}): InventoryPrediction {
  return {
    projectedQuantity: 2,
    projectedStatus: "Critical",
    daysCoverage: 0.4,
    averageDailyUsage: 5,
    suggestedOrderQuantity: 18,
    coverageLabel: "May run out today",
    trendLabel: "Demand rising",
    demandTrend: "rising",
    suggestedAction: "Order 18 lb",
    basis: "Restaurant history",
    depletionCopy: "Used 2 lb today",
    confidenceCopy: "Based on history",
    recommendationCopy: "Order 18 lb",
    whyItMatters: "This can interrupt prep.",
    urgency: "high",
    todayDepletion: 2,
    historySource: "restaurant_history",
    historySampleDays: 14,
    countEvidence: "verified_count",
    countedAt: "2026-08-30T08:00:00.000Z",
    countAgeHours: 2,
    countFreshness: "fresh",
    unattributedTodayDepletion: 0,
    isTemporallyAuthoritative: true,
    ...overrides
  };
}

function recommendation(
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: "rest_1",
    inventory_item_id: "inv_1",
    item_name: "Roma Tomatoes",
    supplier_id: "sup_1",
    supplier_name: "Local Produce Co",
    recommended_quantity: 18,
    unit: "lb",
    reason: "May run out today. This can interrupt prep.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-08-30T00:00:00.000Z",
    ...overrides
  };
}

test("purchaseRecommendationPresentation emits stock_risk codes without English prose", () => {
  const descriptor = purchaseRecommendationPresentation(item(), prediction());
  assert.equal(descriptor.code, "purchase.recommendation.stock_risk");
  assert.equal(descriptor.values.status, "Critical");
  assert.equal(descriptor.values.itemName, "Roma Tomatoes");
  assert.equal(descriptor.values.suggestedOrderQuantity, 18);
  assert.equal(descriptor.values.learnedQuantity, null);
  assert.doesNotMatch(JSON.stringify(descriptor), /may run out today/i);
});

test("purchaseRecommendationPresentation records learned quantity adjustments", () => {
  const descriptor = purchaseRecommendationPresentation(item(), prediction(), 22);
  assert.equal(descriptor.code, "purchase.recommendation.stock_risk");
  if (descriptor.code !== "purchase.recommendation.stock_risk") return;
  assert.equal(descriptor.values.suggestedOrderQuantity, 22);
  assert.equal(descriptor.values.learnedQuantity, 22);
});

test("presentPurchaseRecommendationReason localizes critical and low reasons", () => {
  const critical = recommendation({
    presentation: purchaseRecommendationPresentation(item(), prediction())
  });
  const low = recommendation({
    urgency: "medium",
    presentation: purchaseRecommendationPresentation(
      item(),
      prediction({ projectedStatus: "Low", urgency: "medium" })
    )
  });

  assert.match(presentPurchaseRecommendationReason("en", critical), /may run out today/i);
  assert.match(presentPurchaseRecommendationReason("es", critical), /agotarse hoy/i);
  assert.match(presentPurchaseRecommendationReason("zh-Hans", critical), /缺货/);
  assert.match(presentPurchaseRecommendationReason("es", low), /nivel de reposición/i);
  assert.doesNotMatch(presentPurchaseRecommendationReason("es", critical), /May run out today/);
});

test("presentPurchaseRecommendationReason synthesizes from urgency when presentation is missing", () => {
  const hosted = recommendation({ presentation: undefined });
  const descriptor = purchaseRecommendationReasonDescriptor(hosted);
  assert.equal(descriptor.code, "purchase.recommendation.stock_risk");
  assert.match(presentPurchaseRecommendationReason("es", hosted), /Local Produce Co/);
  assert.doesNotMatch(presentPurchaseRecommendationReason("es", hosted), /May run out today/);
});

test("presentPurchaseRecommendationReason appends learned-quantity note", () => {
  const withLearned = recommendation({
    recommended_quantity: 22,
    presentation: purchaseRecommendationPresentation(item(), prediction(), 22)
  });
  assert.match(
    presentPurchaseRecommendationReason("en", withLearned),
    /stable median from recent approved orders: 22 lb/i
  );
  assert.match(presentPurchaseRecommendationReason("es", withLearned), /mediana estable/i);
});

test("English reason helpers remain available as audit fallback prose", () => {
  assert.match(recommendationReason(item(), prediction()), /May run out today/);
  assert.match(learnedRecommendationReason(item(), prediction(), 22), /stable median/i);
});
