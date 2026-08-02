import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyLossBias,
  buildChronicManagerCorrectionInsightInput,
  buildManagerCorrectionBiasByItem,
  extractManagerCorrectionSamplesFromMovements,
  lossBiasReasonFragment,
  type CountVarianceSample
} from "../services/domain/wasteVarianceLearning";
import {
  applyStackedOrderLearning,
  buildInventoryPrediction,
  planManualPendingRecommendation
} from "../services/domain/miseDomain";
import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";

const itemId = "item_cream";
const now = Date.parse("2026-08-02T12:00:00.000Z");

function correctionSample(
  overrides: Partial<CountVarianceSample> & { daysAgo?: number } = {}
): CountVarianceSample {
  const daysAgo = overrides.daysAgo ?? 1;
  const { daysAgo: _ignored, ...rest } = overrides;
  return {
    inventoryItemId: itemId,
    quantityBefore: 20,
    quantityAfter: 16,
    variance: -4,
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    ...rest
  };
}

test("extractManagerCorrectionSamplesFromMovements reads only downward manager_correction rows", () => {
  const samples = extractManagerCorrectionSamplesFromMovements([
    {
      inventory_item_id: itemId,
      reason: "manager_correction",
      created_at: "2026-08-01T10:00:00.000Z",
      quantity_before: 20,
      quantity_after: 15
    },
    {
      inventory_item_id: itemId,
      reason: "manager_correction",
      created_at: "2026-08-01T11:00:00.000Z",
      quantity_before: 15,
      quantity_after: 18
    },
    {
      inventory_item_id: itemId,
      reason: "manual_count",
      created_at: "2026-08-01T12:00:00.000Z",
      quantity_before: 18,
      quantity_after: 10
    },
    {
      inventory_item_id: itemId,
      reason: "waste",
      created_at: "2026-08-01T13:00:00.000Z",
      quantity_before: 10,
      quantity_after: 8
    }
  ]);

  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.quantityBefore, 20);
  assert.equal(samples[0]?.quantityAfter, 15);
  assert.equal(samples[0]?.variance, -5);
});

test("chronic manager correction shrink pads order quantity within absolute bounds", () => {
  const bias = buildManagerCorrectionBiasByItem(
    [1, 2, 3].map((daysAgo) => correctionSample({ daysAgo })),
    now
  ).get(itemId);
  assert.ok(bias?.isChronic);
  assert.equal(bias?.source, "manager_correction");
  assert.match(lossBiasReasonFragment(bias!), /manager correction/i);

  const padded = applyLossBias(10, bias, { calculated: 10, par: 20 });
  assert.ok(padded != null && padded > 10);
  assert.ok(padded <= Math.max(10 * 1.75, 20 * 1.25));
  assert.ok(buildChronicManagerCorrectionInsightInput(bias!));
});

test("fewer than three manager correction samples do not bias recommendations", () => {
  const bias = buildManagerCorrectionBiasByItem(
    [1, 2].map((daysAgo) => correctionSample({ daysAgo })),
    now
  ).get(itemId);
  assert.equal(bias, undefined);
});

test("manual add-to-order planning pads for chronic manager corrections", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);

  const managerCorrectionHistory = [1, 2, 3].map((daysAgo) => ({
    inventoryItemId: pancakeMix.id,
    quantityBefore: 20,
    quantityAfter: 16,
    variance: -4,
    createdAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString()
  }));

  const prediction = buildInventoryPrediction(
    pancakeMix,
    state.posSales,
    state.menuItemIngredients
  );
  const planned = planManualPendingRecommendation({
    restaurantId: DEMO_RESTAURANT_ID,
    item: pancakeMix,
    prediction,
    managerCorrectionHistory
  });

  assert.ok(planned.recommended_quantity > prediction.suggestedOrderQuantity);
  assert.match(planned.reason, /manager correction/i);
});

test("operational signals emit chronic manager correction insight and pad quantity", () => {
  const result = calculateOperationalSignals({
    restaurantId: "rest_1",
    operatingDate: "2026-08-02",
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: "rest_1",
        item_name: "Heavy cream",
        supplier_name: "Dairy Co",
        unit: "qt",
        current_quantity: 4,
        par_level: 20,
        reorder_threshold: 8
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    managerCorrectionHistory: [1, 2, 3].map((daysAgo) => correctionSample({ daysAgo }))
  });

  const recommendation = result.recommendations.find((entry) => entry.inventory_item_id === itemId);
  assert.ok(recommendation);
  assert.ok(recommendation.recommended_quantity > 16);
  assert.match(recommendation.reason, /manager correction/i);

  const insight = result.insights.find(
    (entry) => entry.presentation.code === "insight.rule.inventory.chronic_manager_correction"
  );
  assert.ok(insight);

  const tasks = deriveOperationalTodayTasks({
    restaurantId: "rest_1",
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    chronicManagerCorrectionItems: [
      {
        inventoryItemId: itemId,
        itemName: "Heavy cream",
        lossPercent: 20,
        sampleCount: 3
      }
    ]
  });
  const task = tasks.find((entry) => entry.source.id === `chronic_manager_correction_${itemId}`);
  assert.ok(task);
  assert.equal(task.requiredRole, "manager");
  assert.equal(task.action.route, "/inventory");
  assert.equal(task.presentation?.code, "today.inventory.chronic_manager_correction");
});

test("applyStackedOrderLearning includes manager correction after count shrink", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const prediction = buildInventoryPrediction(
    pancakeMix,
    state.posSales,
    state.menuItemIngredients
  );
  const managerBias = buildManagerCorrectionBiasByItem(
    [1, 2, 3].map((daysAgo) =>
      correctionSample({ daysAgo, inventoryItemId: pancakeMix.id })
    ),
    Date.now()
  ).get(pancakeMix.id);

  const learned = applyStackedOrderLearning({
    item: pancakeMix,
    prediction,
    learnedQuantities: new Map(),
    managerCorrectionBias: managerBias
  });

  assert.ok(learned.recommendedQuantity > prediction.suggestedOrderQuantity);
  assert.ok(learned.reasonFragments.some((fragment) => /manager correction/i.test(fragment)));
});
