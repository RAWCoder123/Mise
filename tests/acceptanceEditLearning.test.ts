import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acceptanceEditBiasReasonFragment,
  applyAcceptanceEditBias,
  buildAcceptanceEditBiasByItem,
  buildChronicAcceptanceEditInsightInput,
  extractAcceptanceEditSamplesFromRecommendations,
  type AcceptanceEditSample
} from "../services/domain/acceptanceEditLearning";
import {
  applyStackedOrderLearning,
  buildInventoryPrediction,
  planManualPendingRecommendation
} from "../services/domain/miseDomain";
import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";

const itemId = "item_avocado";
const now = Date.parse("2026-08-02T12:00:00.000Z");

function editSample(
  overrides: Partial<AcceptanceEditSample> & { daysAgo?: number; ratio?: number } = {}
): AcceptanceEditSample {
  const daysAgo = overrides.daysAgo ?? 1;
  const ratio = overrides.ratio ?? 1.2;
  const originalQuantity = overrides.originalQuantity ?? 10;
  const { daysAgo: _d, ratio: _r, ...rest } = overrides;
  return {
    inventoryItemId: itemId,
    originalQuantity,
    acceptedQuantity: overrides.acceptedQuantity ?? originalQuantity * ratio,
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    ...rest
  };
}

test("extractAcceptanceEditSamplesFromRecommendations keeps approved/ordered pairs with originals", () => {
  const samples = extractAcceptanceEditSamplesFromRecommendations([
    {
      inventory_item_id: itemId,
      recommended_quantity: 12,
      original_recommended_quantity: 10,
      status: "approved",
      created_at: "2026-08-01T10:00:00.000Z"
    },
    {
      inventory_item_id: itemId,
      recommended_quantity: 8,
      original_recommended_quantity: null,
      status: "approved",
      created_at: "2026-08-01T11:00:00.000Z"
    },
    {
      inventory_item_id: itemId,
      recommended_quantity: 9,
      original_recommended_quantity: 10,
      status: "pending",
      created_at: "2026-08-01T12:00:00.000Z"
    },
    {
      inventory_item_id: itemId,
      recommended_quantity: 14,
      original_recommended_quantity: 10,
      status: "ordered",
      created_at: "2026-08-01T13:00:00.000Z"
    },
    {
      inventory_item_id: itemId,
      recommended_quantity: 0,
      original_recommended_quantity: 10,
      status: "approved",
      created_at: "2026-08-01T14:00:00.000Z"
    }
  ]);

  assert.equal(samples.length, 2);
  assert.equal(samples[0]?.acceptedQuantity, 12);
  assert.equal(samples[1]?.acceptedQuantity, 14);
});

test("chronic upward acceptance edits pad order quantity within absolute bounds", () => {
  const bias = buildAcceptanceEditBiasByItem(
    [1, 2, 3].map((daysAgo) => editSample({ daysAgo, ratio: 1.2 })),
    now
  ).get(itemId);
  assert.ok(bias?.isChronic);
  assert.equal(bias?.direction, "increase");
  assert.match(acceptanceEditBiasReasonFragment(bias!), /padding|120%/i);

  const padded = applyAcceptanceEditBias(10, bias, { calculated: 10, par: 20 });
  assert.ok(padded != null && padded > 10);
  assert.ok(padded <= Math.max(10 * 1.75, 20 * 1.25));
  assert.ok(buildChronicAcceptanceEditInsightInput(bias!));
});

test("chronic downward acceptance edits trim order quantity within absolute bounds", () => {
  const bias = buildAcceptanceEditBiasByItem(
    [1, 2, 3].map((daysAgo) => editSample({ daysAgo, ratio: 0.8 })),
    now
  ).get(itemId);
  assert.ok(bias?.isChronic);
  assert.equal(bias?.direction, "decrease");

  const trimmed = applyAcceptanceEditBias(10, bias, { calculated: 10, par: 20 });
  assert.ok(trimmed != null && trimmed < 10);
  assert.ok(trimmed >= Math.max(1, 10 * 0.5));
});

test("fewer than three acceptance-edit samples do not bias recommendations", () => {
  const bias = buildAcceptanceEditBiasByItem(
    [1, 2].map((daysAgo) => editSample({ daysAgo, ratio: 1.25 })),
    now
  ).get(itemId);
  assert.equal(bias, undefined);
});

test("unchanged approvals alone do not create chronic acceptance-edit bias", () => {
  const bias = buildAcceptanceEditBiasByItem(
    [1, 2, 3].map((daysAgo) => editSample({ daysAgo, ratio: 1 })),
    now
  ).get(itemId);
  assert.equal(bias, undefined);
});

test("manual add-to-order planning pads for chronic upward acceptance edits", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);

  const recommendationHistory = [1, 2, 3].map((daysAgo, index) => ({
    id: `rec_accept_${index}`,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: pancakeMix.id,
    item_name: pancakeMix.item_name,
    supplier_name: pancakeMix.supplier_name,
    recommended_quantity: 12,
    original_recommended_quantity: 10,
    dismiss_reason: null,
    unit: pancakeMix.unit,
    reason: "fixture",
    urgency: "medium" as const,
    status: "approved" as const,
    supplier_order_id: null,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString()
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
    recommendationHistory
  });

  assert.ok(planned.recommended_quantity > prediction.suggestedOrderQuantity);
  assert.match(planned.reason, /acceptance-edit|approved about/i);
});

test("operational signals emit chronic acceptance-edit insight and adjust quantity", () => {
  const recommendationHistory = [1, 2, 3].map((daysAgo) => ({
    inventory_item_id: itemId,
    recommended_quantity: 12,
    original_recommended_quantity: 10,
    unit: "case",
    status: "approved",
    created_at: new Date(now - daysAgo * 86_400_000).toISOString(),
    supplier_order_id: null
  }));

  const result = calculateOperationalSignals({
    restaurantId: "rest_1",
    operatingDate: "2026-08-02",
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: "rest_1",
        item_name: "Avocados",
        supplier_name: "Neighborhood Produce",
        unit: "case",
        current_quantity: 4,
        par_level: 20,
        reorder_threshold: 8,
        // Newer than the approval samples so a fresh recommendation is allowed.
        last_updated: new Date(now).toISOString()
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory
  });

  const recommendation = result.recommendations.find((entry) => entry.inventory_item_id === itemId);
  assert.ok(recommendation);
  assert.ok(recommendation.recommended_quantity > 16);
  assert.match(recommendation.reason, /acceptance-edit|approved about/i);

  const insight = result.insights.find(
    (entry) => entry.presentation.code === "insight.rule.ordering.chronic_acceptance_edit"
  );
  assert.ok(insight);

  const tasks = deriveOperationalTodayTasks({
    restaurantId: "rest_1",
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    chronicAcceptanceEditItems: [
      {
        inventoryItemId: itemId,
        itemName: "Avocados",
        acceptPercent: 120,
        direction: "increase",
        sampleCount: 3
      }
    ]
  });
  const task = tasks.find((entry) => entry.source.id === `chronic_acceptance_edit_${itemId}`);
  assert.ok(task);
  assert.equal(task.requiredRole, "manager");
  assert.equal(task.action.route, "/orders");
  assert.equal(task.presentation?.code, "today.ordering.chronic_acceptance_edit");
});

test("applyStackedOrderLearning prefers acceptance-edit ratio over absolute median learning", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const prediction = buildInventoryPrediction(
    pancakeMix,
    state.posSales,
    state.menuItemIngredients
  );
  const bias = buildAcceptanceEditBiasByItem(
    [1, 2, 3].map((daysAgo) =>
      editSample({ daysAgo, ratio: 1.2, inventoryItemId: pancakeMix.id })
    ),
    Date.now()
  ).get(pancakeMix.id);

  const absoluteMedianKey = `${pancakeMix.id}::${pancakeMix.unit.trim().toLowerCase()}`;
  const learned = applyStackedOrderLearning({
    item: pancakeMix,
    prediction,
    learnedQuantities: new Map([[absoluteMedianKey, prediction.suggestedOrderQuantity * 2]]),
    acceptanceEditBias: bias
  });

  assert.ok(learned.recommendedQuantity > prediction.suggestedOrderQuantity);
  assert.ok(learned.recommendedQuantity < prediction.suggestedOrderQuantity * 2);
  assert.equal(learned.learnedQuantity, undefined);
  assert.ok(learned.reasonFragments.some((fragment) => /acceptance-edit|approved about/i.test(fragment)));
});
