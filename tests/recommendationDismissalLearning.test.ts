import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildChronicDismissalInsightInput,
  buildDismissalFeedbackByItem,
  classifyDismissReason,
  dismissalFeedbackReasonFragment,
  extractDismissalSamplesFromRecommendations,
  type DismissalSample
} from "../services/domain/recommendationDismissalLearning";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";
import {
  applyStackedOrderLearning,
  buildInventoryPrediction,
  planManualPendingRecommendation
} from "../services/domain/miseDomain";
import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";

const itemId = "inv_dismissal_1";
const now = Date.parse("2026-08-02T12:00:00.000Z");

function dismissalSample(
  overrides: Partial<DismissalSample> & { daysAgo?: number } = {}
): DismissalSample {
  const { daysAgo = 1, ...rest } = overrides;
  return {
    inventoryItemId: itemId,
    category: "too_much_stock",
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    ...rest
  };
}

test("classifyDismissReason maps common restaurant phrases without inventing categories", () => {
  assert.equal(classifyDismissReason("Already have enough on hand"), "too_much_stock");
  assert.equal(classifyDismissReason("Already ordered from walk-in"), "already_ordered");
  assert.equal(classifyDismissReason("Too early — wait until next week"), "wrong_timing");
  assert.equal(classifyDismissReason("Wrong item mapped"), "wrong_item");
  assert.equal(classifyDismissReason("Chef preference"), "other");
  assert.equal(classifyDismissReason("   "), null);
  assert.equal(classifyDismissReason(null), null);
});

test("extractDismissalSamplesFromRecommendations keeps dismissed rows with reasons only", () => {
  const samples = extractDismissalSamplesFromRecommendations([
    {
      inventory_item_id: itemId,
      status: "dismissed",
      created_at: new Date(now - 86_400_000).toISOString(),
      dismiss_reason: "Too much stock"
    },
    {
      inventory_item_id: itemId,
      status: "dismissed",
      created_at: new Date(now - 2 * 86_400_000).toISOString(),
      dismiss_reason: null
    },
    {
      inventory_item_id: itemId,
      status: "approved",
      created_at: new Date(now - 3 * 86_400_000).toISOString(),
      dismiss_reason: "Too much stock"
    }
  ]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]?.category, "too_much_stock");
});

test("chronic dominant dismissal category creates feedback without quantity suppression", () => {
  const feedback = buildDismissalFeedbackByItem(
    [1, 2, 3].map((daysAgo) => dismissalSample({ daysAgo })),
    now
  ).get(itemId);
  assert.ok(feedback);
  assert.equal(feedback.category, "too_much_stock");
  assert.equal(feedback.isChronic, true);
  assert.match(dismissalFeedbackReasonFragment(feedback), /too much stock/i);
  assert.ok(buildChronicDismissalInsightInput(feedback));
});

test("mixed categories without a dominant share do not become chronic", () => {
  const feedback = buildDismissalFeedbackByItem(
    [
      dismissalSample({ daysAgo: 1, category: "too_much_stock" }),
      dismissalSample({ daysAgo: 2, category: "wrong_timing" }),
      dismissalSample({ daysAgo: 3, category: "already_ordered" })
    ],
    now
  ).get(itemId);
  assert.equal(feedback, undefined);
});

test("fewer than three dismissal samples do not create chronic feedback", () => {
  const feedback = buildDismissalFeedbackByItem(
    [1, 2].map((daysAgo) => dismissalSample({ daysAgo })),
    now
  ).get(itemId);
  assert.equal(feedback, undefined);
});

test("operational signals emit chronic dismissal insight and reason without changing quantity", () => {
  const recommendationHistory = [1, 2, 3].map((daysAgo) => ({
    inventory_item_id: itemId,
    recommended_quantity: 10,
    original_recommended_quantity: 10,
    unit: "case",
    status: "dismissed",
    dismiss_reason: "Already have enough",
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
        // Newer than dismissals so a fresh recommendation is allowed after inventory change.
        last_updated: new Date(now).toISOString()
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory
  });

  const recommendation = result.recommendations.find((entry) => entry.inventory_item_id === itemId);
  assert.ok(recommendation);
  assert.equal(recommendation.recommended_quantity, 16);
  assert.match(recommendation.reason, /too much stock|dismissed/i);

  const insight = result.insights.find(
    (entry) => entry.presentation.code === "insight.rule.ordering.chronic_dismissal"
  );
  assert.ok(insight);
  assert.equal(insight.presentation.code, "insight.rule.ordering.chronic_dismissal");
  if (insight.presentation.code !== "insight.rule.ordering.chronic_dismissal") {
    throw new Error("expected chronic dismissal insight");
  }
  assert.equal(insight.presentation.values.category, "too_much_stock");

  const tasks = deriveOperationalTodayTasks({
    restaurantId: "rest_1",
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    chronicDismissalItems: [
      {
        inventoryItemId: itemId,
        itemName: "Avocados",
        category: "too_much_stock",
        sampleCount: 3,
        categoryCount: 3
      }
    ]
  });
  const task = tasks.find((entry) => entry.source.id === `chronic_dismissal_${itemId}`);
  assert.ok(task);
  assert.equal(task.requiredRole, "manager");
  assert.equal(task.action.route, "/orders");
  assert.equal(task.presentation?.code, "today.ordering.chronic_dismissal");
});

test("manual add-to-order planning explains chronic dismissal without suppressing quantity", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);

  const recommendationHistory = [1, 2, 3].map((daysAgo, index) => ({
    id: `rec_dismiss_${index}`,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: pancakeMix.id,
    item_name: pancakeMix.item_name,
    supplier_name: pancakeMix.supplier_name,
    recommended_quantity: 10,
    original_recommended_quantity: 10,
    dismiss_reason: "Too early — wait until next week",
    unit: pancakeMix.unit,
    reason: "fixture",
    urgency: "medium" as const,
    status: "dismissed" as const,
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

  assert.equal(planned.recommended_quantity, prediction.suggestedOrderQuantity);
  assert.match(planned.reason, /too early|wrong timing|dismissed/i);
});

test("applyStackedOrderLearning appends dismissal fragment without changing quantity", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const prediction = buildInventoryPrediction(
    pancakeMix,
    state.posSales,
    state.menuItemIngredients
  );
  const dismissalFeedback = buildDismissalFeedbackByItem(
    [1, 2, 3].map((daysAgo) =>
      dismissalSample({
        daysAgo,
        inventoryItemId: pancakeMix.id,
        category: "already_ordered"
      })
    ),
    Date.now()
  ).get(pancakeMix.id);

  const learned = applyStackedOrderLearning({
    item: pancakeMix,
    prediction,
    learnedQuantities: new Map(),
    dismissalFeedback
  });

  assert.equal(learned.recommendedQuantity, prediction.suggestedOrderQuantity);
  assert.ok(
    learned.reasonFragments.some((fragment) => /already ordered|dismissed/i.test(fragment))
  );
});
