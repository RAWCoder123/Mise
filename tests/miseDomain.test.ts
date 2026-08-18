import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoSetupStarterDrafts,
  createInitialDemoState,
  DEMO_DATASET,
  DEMO_RESTAURANT_ID,
  DEMO_RESTAURANT_TIME_ZONE,
  demoDemandFallback,
  rebuildPurchaseRecommendations
} from "../services/demoData";
import {
  buildDemoReadinessSummary,
  buildDemoWalkthroughChecklist,
  buildConditionalAnalyticsSummary,
  buildDraftsFromRecommendations,
  buildSupplierEmailPayload,
  buildInsightsFromData,
  buildHistoricalDemandBaselines,
  buildInsightSummary,
  buildInventoryControlSummary,
  buildInventoryOutlooks,
  buildInventoryPrediction,
  buildLearningMemorySummary,
  buildOrderQueueSummary,
  buildRecommendationInserts,
  buildRecipeBaselineSummary,
  buildSetupReadinessSummary,
  buildTodaySummary,
  shouldSuppressRecommendationForItem
} from "../services/domain/miseDomain";
import {
  normalizeInventoryItemPatch,
  normalizePosSale,
  normalizeRecipeBaselineQuantity,
  normalizeRecommendedQuantity,
  requireInventoryItemPatch,
  requireRecipeBaselineQuantity,
  requireRecommendationApprovalQuantity
} from "../services/miseValidation";
import {
  buildSetupDataHealthSummary,
  buildSetupCompletionAuditMetadata,
  buildSetupPersistencePreview,
  buildSetupDraftReadiness,
  parseSetupPosSalesCsv,
  recipeDraftsToBaselineText
} from "../services/domain/setupDrafts";
import {
  parseStructuredInsightOutput,
  structuredInsightJsonSchema
} from "../services/ai/structuredInsights";
import { getPosAdapter } from "../services/integrations/posAdapters";
import { buildSupplierDraftPresentation, parseSupplierOrderLines } from "../utils/orderPresentation";
import { todayScreenTitle } from "../utils/screenTitles";
import {
  buildInventoryCountEvidence,
  withPendingCountEvidence
} from "../services/domain/inventoryCountAuthority";
import type { InventoryItem } from "../types/mise";
import { addDays, toDateKey, toDateKeyInTimeZone } from "../utils/format";

function isoDaysAgo(days: number) {
  return addDays(new Date(), -days).toISOString();
}

/** Operating date matching the demo restaurant's calendar, as demo callers pass it. */
function demoOperatingDate() {
  return toDateKeyInTimeZone(new Date(), DEMO_RESTAURANT_TIME_ZONE);
}

/**
 * Authoritative physical-count evidence for every demo item at one instant.
 * Planning depends on this ledger evidence, never on `inventory_items.last_updated`.
 */
function countEvidenceAt(
  items: readonly InventoryItem[],
  countedAt: string,
  restaurantId: string = DEMO_RESTAURANT_ID
) {
  const scoped = items.filter((item) => item.restaurant_id === restaurantId);
  return buildInventoryCountEvidence({
    restaurantId,
    items: scoped,
    ledgerEvents: withPendingCountEvidence([], {
      restaurantId,
      inventoryItemIds: scoped.map((item) => item.id),
      countedAt
    }),
    resolveOperatingDate: (iso) => toDateKeyInTimeZone(new Date(iso), DEMO_RESTAURANT_TIME_ZONE)
  });
}

test("restaurant operating dates follow the restaurant timezone", () => {
  const instant = new Date("2026-07-13T02:00:00.000Z");
  assert.equal(toDateKey(instant), "2026-07-13");
  assert.equal(toDateKeyInTimeZone(instant, "America/Los_Angeles"), "2026-07-12");
  assert.equal(toDateKeyInTimeZone(instant, "Invalid/Timezone"), "2026-07-13");
});

test("demo sales use the restaurant date across the UTC date boundary", () => {
  const lateNewYorkEvening = new Date("2026-07-14T03:30:00.000Z");
  const state = createInitialDemoState("Toast", { preset: DEMO_DATASET.id }, lateNewYorkEvening);
  const restaurant = state.restaurants[0]!;
  state.posSales.push({
    ...state.posSales[0]!,
    id: "future_sale_must_not_enter_today_trend",
    sale_date: "2026-07-14",
    gross_sales: 999_999
  });
  const summary = buildTodaySummary(
    restaurant,
    state.posSales,
    state.inventoryItems,
    state.purchaseRecommendations,
    state.insights,
    state.menuItemIngredients,
    "2026-07-13"
  );

  assert.equal(toDateKey(lateNewYorkEvening), "2026-07-14");
  assert.equal(toDateKeyInTimeZone(lateNewYorkEvening, restaurant.timezone), "2026-07-13");
  assert.equal(new Set(state.posSales.slice(0, 6).map((sale) => sale.sale_date)).size, 1);
  assert.equal(state.posSales[0]?.sale_date, "2026-07-13");
  assert.equal(summary.salesToday, 7898);
  const actualTrendTotals = [...state.posSales.filter((sale) => sale.sale_date <= "2026-07-13").reduce((totals, sale) => {
    totals.set(sale.sale_date, (totals.get(sale.sale_date) ?? 0) + sale.gross_sales);
    return totals;
  }, new Map<string, number>()).entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .slice(-6)
    .map(([, total]) => Math.round(total * 100) / 100);
  assert.deepEqual(summary.salesTrend.map((point) => point.sales), actualTrendTotals);
  assert.ok(summary.salesTrend.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.label)));
  assert.equal(summary.salesTrend.some((point) => point.label === "2026-07-14"), false);
});

test("inventory outlooks sort urgent kitchen items first", () => {
  const state = createInitialDemoState("Toast");
  const outlooks = buildInventoryOutlooks(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(),
    demoDemandFallback
  );

  assert.equal(outlooks[0]?.item.item_name, "Chicken breast");
  assert.equal(outlooks[0]?.prediction.urgency, "high");
  assert.equal(outlooks[0]?.prediction.projectedStatus, "Critical");
  assert.equal(outlooks[0]?.prediction.projectedQuantity, 0);
  assert.equal(outlooks[0]?.prediction.todayDepletion, 21);
  assert.match(outlooks[0]?.prediction.coverageLabel ?? "", /run out today/i);
  assert.match(outlooks[0]?.prediction.suggestedAction ?? "", /Order/);

  const summary = buildInventoryControlSummary(DEMO_RESTAURANT_ID, outlooks);
  assert.equal(summary.needOrderCount, 6);
  assert.equal(summary.watchCount, 1);
  assert.equal(summary.categoryCounts.proteins, 2);
  assert.equal(summary.categoryCounts.produce, 2);
  assert.match(summary.readinessLabel, /risk/i);
});

test("real restaurants never inherit static demo demand assumptions", () => {
  const restaurantId = "real_restaurant";
  const item = {
    id: "real_chicken",
    restaurant_id: restaurantId,
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 20,
    par_level: 40,
    reorder_threshold: 10,
    estimated_unit_cost: 4,
    supplier_name: "Fresh Co.",
    last_updated: new Date().toISOString()
  };
  const prediction = buildInventoryPrediction(item, [], [{
    id: "real_mapping",
    restaurant_id: restaurantId,
    menu_item_name: "Chicken Bowl",
    inventory_item_id: item.id,
    quantity_used_per_sale: 0.5,
    unit: "lb"
  }], toDateKey(new Date()));

  assert.equal(prediction.averageDailyUsage, 0);
  assert.equal(prediction.historySource, "none");
  assert.equal(prediction.historySampleDays, 0);
});

test("historical demand learns a robust restaurant-specific service-day baseline", () => {
  const restaurantId = "history_restaurant";
  const historicalSales = Array.from({ length: 10 }, (_, index) => ({
    id: `history_sale_${index}`,
    restaurant_id: restaurantId,
    source_record_id: `history_row_${index}`,
    sale_date: toDateKey(addDays(new Date(), -(index + 1))),
    item_name: "Chicken Bowl",
    category: "Entree",
    quantity_sold: index === 4 ? 1000 : 10,
    gross_sales: 100,
    net_sales: 93,
    source_pos: "Test POS",
    created_at: new Date().toISOString()
  }));
  const baselines = buildHistoricalDemandBaselines(restaurantId, historicalSales, toDateKey(new Date()));
  const baseline = baselines.get("chicken bowl");

  assert.ok(baseline);
  assert.equal(baseline.dailyQuantity, 10);
  assert.equal(baseline.sampleDays, 10);
  assert.equal(baseline.observedDays, 10);
});

test("rolling demand memory adapts as sustained newer behavior replaces old service days", () => {
  const restaurantId = "adaptive_restaurant";
  const buildSales = (newQuantity: number, oldQuantity: number) => Array.from({ length: 28 }, (_, index) => ({
    id: `adaptive_sale_${newQuantity}_${oldQuantity}_${index}`,
    restaurant_id: restaurantId,
    sale_date: toDateKey(addDays(new Date(), -(index + 1))),
    item_name: "Rice Bowl",
    category: "Entree",
    quantity_sold: index < 14 ? newQuantity : oldQuantity,
    gross_sales: 100,
    net_sales: 93,
    source_pos: "Test POS",
    created_at: new Date().toISOString()
  }));
  const transitioning = buildHistoricalDemandBaselines(restaurantId, buildSales(20, 10), toDateKey(new Date())).get("rice bowl");
  const adapted = buildHistoricalDemandBaselines(restaurantId, buildSales(20, 20), toDateKey(new Date())).get("rice bowl");

  assert.ok(transitioning);
  assert.ok(adapted);
  assert.equal(transitioning.dailyQuantity, 15);
  assert.equal(adapted.dailyQuantity, 20);
  assert.ok(adapted.dailyQuantity > transitioning.dailyQuantity);
});

test("coverage blends current depletion with learned demand and exposes its evidence", () => {
  const restaurantId = "evidence_restaurant";
  const item = {
    id: "evidence_chicken",
    restaurant_id: restaurantId,
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 30,
    par_level: 50,
    reorder_threshold: 12,
    estimated_unit_cost: 4,
    supplier_name: "Fresh Co.",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `evidence_history_${index}`,
    restaurant_id: restaurantId,
    sale_date: toDateKey(addDays(new Date(), -(index + 1))),
    item_name: "Chicken Bowl",
    category: "Entree",
    quantity_sold: 20,
    gross_sales: 200,
    net_sales: 186,
    source_pos: "Test POS",
    created_at: new Date().toISOString()
  }));
  const todaySale = {
    ...historicalSales[0]!,
    id: "evidence_today",
    sale_date: toDateKey(new Date()),
    quantity_sold: 40
  };
  const prediction = buildInventoryPrediction(item, [...historicalSales, todaySale], [{
    id: "evidence_mapping",
    restaurant_id: restaurantId,
    menu_item_name: " chicken   bowl ",
    inventory_item_id: item.id,
    quantity_used_per_sale: 0.5,
    unit: "lb"
  }], toDateKey(new Date()));

  assert.equal(prediction.todayDepletion, 20);
  assert.equal(prediction.averageDailyUsage, 13.5);
  assert.equal(prediction.historySource, "restaurant_history");
  assert.equal(prediction.historySampleDays, 8);
  assert.match(prediction.basis, /8 recent service days/i);
  assert.match(prediction.confidenceCopy, /trimmed rolling average/i);
});

test("purchase recommendation inserts are idempotent pending inputs by low-stock item", () => {
  const state = createInitialDemoState("Toast");
  const inserts = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [],
    demoOperatingDate(),
    demoDemandFallback
  );

  assert.equal(inserts.length, 6);
  assert.equal(new Set(inserts.map((insert) => insert.inventory_item_id)).size, inserts.length);
  assert.ok(inserts.every((insert) => insert.status === "pending"));
  assert.ok(inserts.some((insert) => insert.item_name === "Pancake mix" && insert.recommended_quantity === 40));
});

test("purchase recommendations learn a bounded median from repeated approved quantities", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);

  const history = [
    {
      id: "rec_old",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: pancakeMix.id,
      item_name: pancakeMix.item_name,
      supplier_name: pancakeMix.supplier_name,
      recommended_quantity: 32,
      unit: pancakeMix.unit,
      reason: "Earlier approved order",
      urgency: "medium" as const,
      status: "approved" as const,
      supplier_order_id: null,
      created_at: isoDaysAgo(12)
    },
    {
      id: "rec_latest",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: pancakeMix.id,
      item_name: pancakeMix.item_name,
      supplier_name: pancakeMix.supplier_name,
      recommended_quantity: 54,
      unit: pancakeMix.unit,
      reason: "Latest approved order",
      urgency: "medium" as const,
      status: "approved" as const,
      supplier_order_id: null,
      created_at: isoDaysAgo(2)
    },
    {
      id: "rec_middle",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: pancakeMix.id,
      item_name: pancakeMix.item_name,
      supplier_name: pancakeMix.supplier_name,
      recommended_quantity: 50,
      unit: pancakeMix.unit,
      reason: "Repeated approved order",
      urgency: "medium" as const,
      status: "ordered" as const,
      supplier_order_id: null,
      created_at: isoDaysAgo(7)
    }
  ];

  const inserts = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    history,
    demoOperatingDate(),
    demoDemandFallback,
    countEvidenceAt(state.inventoryItems, isoDaysAgo(1))
  );
  const pancakeRecommendation = inserts.find((insert) => insert.inventory_item_id === pancakeMix.id);

  assert.equal(pancakeRecommendation?.recommended_quantity, 50);
  assert.match(pancakeRecommendation?.reason ?? "", /stable median/i);
});

test("one anomalous approval does not override the calculated recommendation", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const history = [{
    id: "rec_anomaly",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: pancakeMix.id,
    item_name: pancakeMix.item_name,
    supplier_name: pancakeMix.supplier_name,
    recommended_quantity: 1e100,
    unit: pancakeMix.unit,
    reason: "Anomalous approval",
    urgency: "medium" as const,
    status: "approved" as const,
    supplier_order_id: null,
    created_at: "2026-06-19T08:00:00.000Z"
  }];

  const inserts = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    history,
    demoOperatingDate(),
    demoDemandFallback,
    countEvidenceAt(state.inventoryItems, isoDaysAgo(1))
  );
  const pancakeRecommendation = inserts.find((insert) => insert.inventory_item_id === pancakeMix.id);
  assert.equal(pancakeRecommendation?.recommended_quantity, 40);
  assert.doesNotMatch(pancakeRecommendation?.reason ?? "", /stable median/i);
});

test("stale approvals age out of recommendation learning", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const staleHistory = [210, 220, 230].map((daysAgo, index) => ({
    id: `rec_stale_${index}`,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: pancakeMix.id,
    item_name: pancakeMix.item_name,
    supplier_name: pancakeMix.supplier_name,
    recommended_quantity: 55,
    unit: pancakeMix.unit,
    reason: "Old approved order",
    urgency: "medium" as const,
    status: "approved" as const,
    supplier_order_id: null,
    created_at: isoDaysAgo(daysAgo)
  }));
  const recommendation = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    staleHistory,
    demoOperatingDate(),
    demoDemandFallback,
    countEvidenceAt(state.inventoryItems, isoDaysAgo(1))
  ).find((entry) => entry.inventory_item_id === pancakeMix.id);

  assert.equal(recommendation?.recommended_quantity, 40);
  assert.doesNotMatch(recommendation?.reason ?? "", /stable median/i);
});

test("recommendation learning never mixes incompatible purchasing units", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const incompatibleHistory = [2, 3, 4].map((daysAgo, index) => ({
    id: `rec_case_${index}`,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: pancakeMix.id,
    item_name: pancakeMix.item_name,
    supplier_name: pancakeMix.supplier_name,
    recommended_quantity: 6,
    unit: "case",
    reason: "Approved in cases",
    urgency: "medium" as const,
    status: "ordered" as const,
    supplier_order_id: null,
    created_at: isoDaysAgo(daysAgo)
  }));
  const recommendation = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    incompatibleHistory,
    demoOperatingDate(),
    demoDemandFallback,
    countEvidenceAt(state.inventoryItems, isoDaysAgo(1))
  ).find((entry) => entry.inventory_item_id === pancakeMix.id);

  assert.equal(recommendation?.recommended_quantity, 40);
  assert.doesNotMatch(recommendation?.reason ?? "", /stable median/i);
});

test("repeated recent approvals move learned quantities as operator behavior changes", () => {
  const state = createInitialDemoState("Toast");
  const pancakeMix = state.inventoryItems.find((item) => item.item_name === "Pancake mix");
  assert.ok(pancakeMix);
  const history = [
    ...[150, 140, 130].map((daysAgo, index) => ({
      id: `rec_early_${index}`,
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: pancakeMix.id,
      item_name: pancakeMix.item_name,
      supplier_name: pancakeMix.supplier_name,
      recommended_quantity: 42,
      unit: pancakeMix.unit,
      reason: "Earlier approved order",
      urgency: "medium" as const,
      status: "ordered" as const,
      supplier_order_id: null,
      created_at: isoDaysAgo(daysAgo)
    })),
    ...[6, 5, 4, 3, 2].map((daysAgo, index) => ({
      id: `rec_recent_${index}`,
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: pancakeMix.id,
      item_name: pancakeMix.item_name,
      supplier_name: pancakeMix.supplier_name,
      recommended_quantity: 55,
      unit: pancakeMix.unit,
      reason: "Recent approved order",
      urgency: "medium" as const,
      status: "ordered" as const,
      supplier_order_id: null,
      created_at: isoDaysAgo(daysAgo)
    }))
  ];
  const recommendation = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    history,
    demoOperatingDate(),
    demoDemandFallback,
    countEvidenceAt(state.inventoryItems, isoDaysAgo(1))
  ).find((entry) => entry.inventory_item_id === pancakeMix.id);

  assert.equal(recommendation?.recommended_quantity, 55);
  assert.match(recommendation?.reason ?? "", /stable median/i);
});

test("handled recommendations stay suppressed until a newer verified physical count", () => {
  const state = createInitialDemoState("Toast");
  const chicken = state.inventoryItems.find((item) => item.item_name === "Chicken breast");
  assert.ok(chicken);
  const handledRecommendation = {
    id: "rec_recent_dismissed",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: chicken.id,
    item_name: chicken.item_name,
    supplier_name: chicken.supplier_name,
    recommended_quantity: 20,
    unit: chicken.unit,
    reason: "Operator dismissed during service.",
    urgency: "high" as const,
    status: "dismissed" as const,
    supplier_order_id: null,
    created_at: isoDaysAgo(3)
  };
  const countBeforeHandling = countEvidenceAt(state.inventoryItems, isoDaysAgo(4));
  const countAfterHandling = countEvidenceAt(state.inventoryItems, isoDaysAgo(1));

  const suppressed = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [handledRecommendation],
    demoOperatingDate(),
    demoDemandFallback,
    countBeforeHandling
  );
  assert.equal(
    shouldSuppressRecommendationForItem(DEMO_RESTAURANT_ID, chicken, [handledRecommendation], countBeforeHandling),
    true
  );
  assert.equal(suppressed.some((insert) => insert.inventory_item_id === chicken.id), false);

  // A later policy, cost, or supplier edit bumps `last_updated` but is not count evidence.
  chicken.last_updated = new Date().toISOString();
  assert.equal(
    shouldSuppressRecommendationForItem(DEMO_RESTAURANT_ID, chicken, [handledRecommendation], countBeforeHandling),
    true
  );
  // With no verified count at all Mise fails closed and keeps the suppression.
  assert.equal(
    shouldSuppressRecommendationForItem(DEMO_RESTAURANT_ID, chicken, [handledRecommendation]),
    true
  );

  const regenerated = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [handledRecommendation],
    demoOperatingDate(),
    demoDemandFallback,
    countAfterHandling
  );
  assert.equal(
    shouldSuppressRecommendationForItem(DEMO_RESTAURANT_ID, chicken, [handledRecommendation], countAfterHandling),
    false
  );
  assert.equal(regenerated.some((insert) => insert.inventory_item_id === chicken.id), true);
});

test("approved and ordered recommendations also suppress duplicate pending rows", () => {
  const state = createInitialDemoState("Toast");
  const rice = state.inventoryItems.find((item) => item.item_name === "Rice");
  assert.ok(rice);
  rice.last_updated = "2026-06-20T09:00:00.000Z";
  const handledStatuses = ["approved", "ordered"] as const;

  handledStatuses.forEach((status) => {
    const inserts = buildRecommendationInserts(
      DEMO_RESTAURANT_ID,
      state.inventoryItems,
      state.posSales,
      state.menuItemIngredients,
      [
        {
          id: `rec_${status}`,
          restaurant_id: DEMO_RESTAURANT_ID,
          inventory_item_id: rice.id,
          item_name: rice.item_name,
          supplier_name: rice.supplier_name,
          recommended_quantity: 50,
          unit: rice.unit,
          reason: "Handled by operator.",
          urgency: "medium" as const,
          status,
          supplier_order_id: null,
          created_at: "2026-06-20T09:30:00.000Z"
        }
      ],
      demoOperatingDate(),
      demoDemandFallback
    );
    assert.equal(inserts.some((insert) => insert.inventory_item_id === rice.id), false);
  });
});

test("demo recommendation rebuild uses full history without browser runtime errors", () => {
  const state = createInitialDemoState("Toast");
  const chicken = state.inventoryItems.find((item) => item.item_name === "Chicken breast");
  assert.ok(chicken);
  chicken.last_updated = "2026-06-20T09:00:00.000Z";
  state.purchaseRecommendations.push({
    id: "rec_browser_regression",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: chicken.id,
    item_name: chicken.item_name,
    supplier_name: chicken.supplier_name,
    recommended_quantity: 12,
    unit: chicken.unit,
    reason: "Operator already handled this recommendation.",
    urgency: "high",
    status: "dismissed",
    supplier_order_id: null,
    created_at: "2026-06-20T09:30:00.000Z"
  });

  assert.doesNotThrow(() => rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID));
  assert.equal(
    state.purchaseRecommendations.some(
      (recommendation) =>
        recommendation.inventory_item_id === chicken.id &&
        recommendation.status === "pending"
    ),
    false
  );
});

test("validation normalizes reads and rejects invalid mutation quantities", () => {
  const patch = normalizeInventoryItemPatch({
    current_quantity: -4,
    par_level: Number.NaN,
    reorder_threshold: "6" as never,
    supplier_name: 42 as never
  });
  const sale = normalizePosSale({
    id: "sale_test",
    restaurant_id: DEMO_RESTAURANT_ID,
    sale_date: "2026-06-20",
    item_name: "Burger",
    category: "Entree",
    quantity_sold: -2,
    gross_sales: "18.50" as never,
    net_sales: Number.NaN,
    source_pos: "Toast",
    created_at: new Date().toISOString()
  });

  assert.deepEqual(patch, {
    current_quantity: 0,
    par_level: 0,
    reorder_threshold: 6,
    supplier_name: "Supplier"
  });
  assert.equal(sale.quantity_sold, 0);
  assert.equal(sale.gross_sales, 18.5);
  assert.equal(sale.net_sales, 0);
  assert.equal(normalizeRecommendedQuantity(-8), 0);
  assert.equal(normalizeRecipeBaselineQuantity(-1.25), 0);
  assert.equal(requireRecommendationApprovalQuantity(12), 12);
  for (const invalid of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
    assert.throws(
      () => requireRecommendationApprovalQuantity(invalid),
      /Enter a quantity from 1 to 1,000,000/
    );
  }
  assert.deepEqual(requireInventoryItemPatch({ par_level: 10 }), { par_level: 10 });
  assert.throws(
    () => requireInventoryItemPatch({ current_quantity: 0 }),
    /remain auditable/
  );
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
    assert.throws(() => requireInventoryItemPatch({ par_level: invalid }), /Par level must be between/);
  }
  assert.equal(requireRecipeBaselineQuantity(0.5), 0.5);
  for (const invalid of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY, 10_001]) {
    assert.throws(() => requireRecipeBaselineQuantity(invalid), /Enter a baseline quantity/);
  }
});

test("supplier drafts group approved recommendations by supplier", () => {
  const state = createInitialDemoState("Toast");
  const pendingInserts = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [],
    demoOperatingDate(),
    demoDemandFallback
  );
  const pendingRecommendations = pendingInserts.map((insert, index) => ({
    ...insert,
    id: `rec_${index}`,
    status: "pending" as const,
    created_at: new Date().toISOString()
  }));
  const approvedInserts = pendingRecommendations.map((insert) => ({
    ...insert,
    status: "approved" as const,
  }));

  const orderedHistory = {
    ...approvedInserts[0]!,
    id: "rec_ordered_history",
    item_name: "Already ordered item",
    recommended_quantity: 999,
    status: "ordered" as const
  };
  const dismissedHistory = {
    ...approvedInserts[1]!,
    id: "rec_dismissed_history",
    item_name: "Dismissed item",
    recommended_quantity: 999,
    status: "dismissed" as const
  };

  const drafts = buildDraftsFromRecommendations(DEMO_RESTAURANT_ID, [
    ...approvedInserts,
    orderedHistory,
    dismissedHistory
  ]);
  const summary = buildOrderQueueSummary(DEMO_RESTAURANT_ID, pendingRecommendations, drafts);

  assert.equal(drafts.length, new Set(pendingRecommendations.map((insert) => insert.supplier_name)).size);
  assert.ok(drafts.every((draft) => draft.order_message.includes("Delivery requested")));
  assert.ok(drafts.every((draft) => !draft.order_message.includes("Already ordered item")));
  assert.ok(drafts.every((draft) => !draft.order_message.includes("Dismissed item")));
  assert.equal(summary.pendingItems, pendingRecommendations.length);
  assert.equal(summary.supplierCount, drafts.length);
  assert.equal(summary.highUrgencyItems, pendingRecommendations.filter((insert) => insert.urgency === "high").length);
  assert.match(summary.readinessLabel, /review/i);
});

test("order queue summary counts draft suppliers when recommendations are cleared", () => {
  const state = createInitialDemoState("Toast");
  const approvedRecommendations = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [],
    demoOperatingDate(),
    demoDemandFallback
  ).map((insert, index) => ({
    ...insert,
    id: `rec_approved_${index}`,
    status: "approved" as const,
    created_at: new Date().toISOString()
  }));
  const drafts = buildDraftsFromRecommendations(DEMO_RESTAURANT_ID, approvedRecommendations);
  const summary = buildOrderQueueSummary(DEMO_RESTAURANT_ID, [], drafts);

  assert.equal(summary.pendingItems, 0);
  assert.equal(summary.supplierCount, new Set(drafts.map((draft) => draft.supplier_name)).size);
  assert.equal(summary.draftCount, drafts.length);
  assert.match(summary.readinessLabel, /drafts ready/i);
  assert.match(summary.operatorCopy, /supplier draft/i);
});

test("recipe baseline summary proves POS sales can deplete mapped ingredients", () => {
  const state = createInitialDemoState("Toast");
  const summary = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate()
  );

  assert.equal(summary.menuItemsTracked, 5);
  assert.equal(summary.ingredientMappings, 10);
  assert.equal(summary.coveragePercent, 100);
  assert.equal(summary.posItemsMissingRecipes.length, 0);
  assert.match(summary.credibilityLabel, /strong/i);
  const chickenBowl = summary.items.find((item) => item.menu_item_name === "Chicken Bowl");
  assert.ok(chickenBowl);
  assert.equal(chickenBowl.ingredientCount, 2);
  assert.ok(
    chickenBowl.ingredients.some(
      (ingredient) =>
        ingredient.itemName === "Chicken breast" &&
        ingredient.quantityUsedPerSale === 0.5 &&
        ingredient.unit === "lbs"
    )
  );

  const chickenMapping = state.menuItemIngredients.find(
    (mapping) => mapping.menu_item_name === "Chicken Bowl" && mapping.unit === "lbs"
  );
  assert.ok(chickenMapping);
  chickenMapping.quantity_used_per_sale = 0.75;
  const updatedSummary = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate()
  );
  assert.ok(
    updatedSummary.items
      .find((item) => item.menu_item_name === "Chicken Bowl")
      ?.ingredients.some((ingredient) => ingredient.itemName === "Chicken breast" && ingredient.quantityUsedPerSale === 0.75)
  );
});

test("demo setup profile customizes seeded suppliers, stock names, and recipe baselines", () => {
  const state = createInitialDemoState("Square", {
    supplierNames: ["North Market", "Farm Co."],
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: "Chicken Bowl: chicken breast 0.25 lbs, rice 0.4 lbs"
  });

  assert.equal(state.inventoryItems[0]?.item_name, "Duck breast");
  assert.equal(state.inventoryItems[1]?.item_name, "Jasmine rice");
  assert.deepEqual(
    [...new Set(state.inventoryItems.slice(0, 4).map((item) => item.supplier_name))],
    ["North Market", "Farm Co."]
  );

  const chickenBowlMappings = state.menuItemIngredients.filter(
    (mapping) => mapping.menu_item_name === "Chicken Bowl"
  );
  assert.equal(chickenBowlMappings.length, 2);
  assert.deepEqual(
    chickenBowlMappings.map((mapping) => mapping.quantity_used_per_sale),
    [0.25, 0.4]
  );
});

test("demo setup profile can replace POS sales with guided imported rows", () => {
  const state = createInitialDemoState("Toast", {
    posSales: [
      {
        id: "setup_sale_1",
        saleDate: "2026-06-30",
        itemName: "Duck Noodle Bowl",
        category: "Noodles",
        quantitySold: 18,
        grossSales: 270,
        sourcePos: "Manual CSV Upload"
      },
      {
        id: "setup_sale_2",
        saleDate: "2026-06-30",
        itemName: "Scallion Pancake",
        category: "Appetizers",
        quantitySold: 12,
        grossSales: 96,
        sourcePos: "Manual CSV Upload"
      }
    ]
  });

  assert.equal(state.posSales.length, 2);
  assert.equal(state.posSales.every((sale) => sale.source_pos === "Manual CSV Upload"), true);
  assert.equal(state.posSales[0]?.item_name, "Duck Noodle Bowl");
  assert.equal(state.salesImports[0]?.import_type, "csv_upload");
  assert.equal(state.salesImports[0]?.records_processed, 2);
  assert.equal(state.salesImports[0]?.metadata.raw_file_stored, false);
});

test("adding a recipe baseline mapping closes a POS coverage gap", () => {
  const state = createInitialDemoState("Toast");
  const tomatoes = state.inventoryItems.find((item) => item.item_name === "Tomatoes");
  assert.ok(tomatoes);

  state.posSales.push({
    id: "sale_veggie_bowl",
    restaurant_id: DEMO_RESTAURANT_ID,
    sale_date: state.posSales[0]!.sale_date,
    item_name: "Veggie Bowl",
    category: "Bowls",
    quantity_sold: 12,
    gross_sales: 144,
    net_sales: 132,
    source_pos: "Toast",
    created_at: new Date().toISOString()
  });

  const missingSummary = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate()
  );
  assert.deepEqual(missingSummary.posItemsMissingRecipes, ["Veggie Bowl"]);
  assert.equal(missingSummary.coveragePercent, 83);

  state.menuItemIngredients.push({
    id: "mapping_veggie_tomatoes",
    restaurant_id: DEMO_RESTAURANT_ID,
    menu_item_name: "Veggie Bowl",
    inventory_item_id: tomatoes.id,
    quantity_used_per_sale: 0.2,
    unit: tomatoes.unit
  });
  const mappedSummary = buildRecipeBaselineSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    demoOperatingDate()
  );

  assert.equal(mappedSummary.posItemsMissingRecipes.length, 0);
  assert.equal(mappedSummary.coveragePercent, 100);
  assert.ok(
    mappedSummary.items
      .find((item) => item.menu_item_name === "Veggie Bowl")
      ?.ingredients.some((ingredient) => ingredient.itemName === "Tomatoes" && ingredient.quantityUsedPerSale === 0.2)
  );
});

test("insights and today summary use the same generated operating data", () => {
  const state = createInitialDemoState("Toast");
  const insights = buildInsightsFromData(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(),
    demoDemandFallback
  );
  const recommendations = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [],
    demoOperatingDate(),
    demoDemandFallback
  ).map((insert, index) => ({
    ...insert,
    id: `rec_${index}`,
    created_at: new Date().toISOString()
  }));

  const summary = buildTodaySummary(
    state.restaurants[0]!,
    state.posSales,
    state.inventoryItems,
    recommendations,
    insights,
    state.menuItemIngredients,
    demoOperatingDate(),
    demoDemandFallback
  );
  const insightSummary = buildInsightSummary(DEMO_RESTAURANT_ID, insights);
  const orderedRecommendations = recommendations.map((recommendation, index) => ({
    ...recommendation,
    status: index === 0 ? ("ordered" as const) : recommendation.status
  }));
  const memorySummary = buildLearningMemorySummary(
    state.restaurants[0]!,
    state.posSales,
    state.inventoryItems,
    orderedRecommendations,
    insights,
    state.menuItemIngredients
  );

  assert.equal(summary.salesToday, 1882);
  assert.equal(summary.pendingRecommendations, 6);
  assert.equal(summary.recipeBaseline.coveragePercent, 100);
  assert.equal(summary.inventoryAlerts, 7);
  assert.deepEqual(summary.workflow, {
    posMenuItemsCovered: 5,
    recipeLinks: 10,
    projectedDepletedItems: 7,
    pendingOrderItems: 6
  });
  assert.equal(summary.credibility.score, 100);
  assert.match(summary.credibility.label, /high/i);
  assert.ok(summary.credibility.evidence.some((line) => line.includes("100% POS recipe coverage")));
  assert.ok(summary.attentionCards.length >= 3);
  assert.ok(insights.some((insight) => insight.severity === "urgent"));
  assert.equal(insightSummary.signalCount, insights.length);
  assert.ok(insightSummary.urgentCount > 0);
  assert.match(insightSummary.readinessLabel, /manager/i);
  assert.match(memorySummary.label, /building/i);
  assert.ok(memorySummary.signals.some((signal) => signal.label === "Recipe coverage" && signal.value === "100%"));
  assert.ok(memorySummary.signals.some((signal) => signal.label === "Demand memory" && signal.value === "Learning"));
  assert.ok(memorySummary.signals.some((signal) => signal.label === "Order memory" && signal.value === "1"));
  assert.match(memorySummary.nextStep, /seven service days/i);

  const unprovenMemorySummary = buildLearningMemorySummary(
    state.restaurants[0]!,
    state.posSales,
    state.inventoryItems,
    recommendations,
    insights,
    state.menuItemIngredients
  );
  assert.equal(unprovenMemorySummary.score, 60);
  assert.match(unprovenMemorySummary.label, /building/i);
  assert.match(unprovenMemorySummary.nextStep, /seven service days/i);
});

test("demo readiness summary tracks the iOS walkthrough prerequisites", () => {
  const state = createInitialDemoState("Toast");
  const recommendations = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [],
    demoOperatingDate(),
    demoDemandFallback
  ).map((insert, index) => ({
    ...insert,
    id: `rec_${index}`,
    created_at: new Date().toISOString()
  }));
  const insights = buildInsightsFromData(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(),
    demoDemandFallback
  );

  const summary = buildDemoReadinessSummary(
    state.restaurants[0]!,
    state.posSales,
    state.inventoryItems,
    recommendations,
    insights,
    state.menuItemIngredients,
    [],
    { demandFallback: demoDemandFallback }
  );

  assert.equal(summary.status, "ready");
  assert.equal(summary.completedCount, summary.totalCount);
  assert.equal(summary.score, 100);
  assert.ok(summary.checks.some((check) => check.id === "orders" && check.status === "ready"));
  assert.ok(summary.walkthroughChecks.some((check) => check.id === "run_without_live_integrations" && check.status === "ready"));
  assert.match(summary.nextStep, /iPhone walkthrough/i);
});

test("demo walkthrough checklist covers independent tester workflow", () => {
  const state = createInitialDemoState("Toast", { preset: DEMO_DATASET.id });
  const restaurant = state.restaurants[0]!;
  const recommendations = buildRecommendationInserts(
    restaurant.id,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    [],
    demoOperatingDate(),
    demoDemandFallback
  ).map((insert, index) => ({
    ...insert,
    id: `walkthrough_rec_${index}`,
    created_at: new Date().toISOString()
  }));
  const insights = buildInsightsFromData(
    restaurant.id,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    demoOperatingDate(),
    demoDemandFallback
  );

  const checklist = buildDemoWalkthroughChecklist(
    restaurant,
    state.posSales,
    state.inventoryItems,
    recommendations,
    insights,
    state.menuItemIngredients,
    state.supplierOrders,
    { demoProfileName: DEMO_DATASET.restaurant.name }
  );
  const byId = new Map(checklist.map((check) => [check.id, check]));

  assert.equal(checklist.length >= 12, true);
  assert.equal(byId.get("enter_demo_data")?.status, "ready");
  assert.equal(byId.get("view_today_command_center")?.route, "/today");
  assert.equal(byId.get("approve_dismiss_undo_recommendation")?.status, "ready");
  assert.equal(byId.get("copy_supplier_order")?.status, "ready");
  assert.equal(byId.get("view_sent_history")?.status, "ready");
  assert.equal(byId.get("run_without_live_integrations")?.status, "ready");
});

test("restaurant profile seed carries brand and operational identity", () => {
  const state = createInitialDemoState("Square", {
    supplierNames: ["North Market", "Farm Co."]
  });
  const restaurant = state.restaurants[0]!;

  assert.equal(restaurant.brand_color, "#EF3F27");
  assert.equal(restaurant.accent_color, "#EF3F27");
  assert.equal(restaurant.service_style, "fast_casual");
  assert.deepEqual(restaurant.operational_profile.primarySuppliers, ["North Market", "Farm Co."]);
  assert.equal(state.posIntegrations[0]?.provider, "square");
  assert.equal(state.posIntegrations[0]?.status, "connected");
  assert.equal(state.supplierItems.length, state.inventoryItems.length);
});

test("setup readiness names missing inventory, recipes, suppliers, and email sender", () => {
  const state = createInitialDemoState("Toast");
  const restaurant = state.restaurants[0]!;
  const summary = buildSetupReadinessSummary({
    restaurant,
    sales: state.posSales,
    inventoryItems: [],
    mappings: [],
    orders: [],
    emailConnection: state.emailConnections[0] ?? null
  });

  assert.equal(summary.currentStep, "inventory");
  assert.equal(summary.steps.find((step) => step.id === "profile")?.status, "complete");
  assert.equal(summary.steps.find((step) => step.id === "inventory")?.status, "active");
  assert.ok(summary.missingInventory.some((item) => item.includes("inventory")));
  assert.deepEqual(summary.missingSuppliers, ["supplier list"]);
  assert.ok(summary.missingRecipes.some((item) => item.includes("dish")));
  assert.equal(summary.missingEmailSender, true);
  assert.equal(summary.emailConnectionStatus, "not_connected");
});

test("setup draft readiness uses list-style inventory, supplier, recipe, and email inputs", () => {
  const readiness = buildSetupDraftReadiness({
    restaurantName: "Luna Bistro",
    cuisineType: "Fast casual",
    inventoryItems: [
      { id: "i1", name: "Chicken breast", quantity: "3.2", unit: "lb", parLevel: "20", supplier: "Fresh Poultry" },
      { id: "i2", name: "Rice", quantity: "25", unit: "lb", parLevel: "50", supplier: "Depot" },
      { id: "i3", name: "Roma Tomatoes", quantity: "8", unit: "lb", parLevel: "24", supplier: "Produce Co." }
    ],
    suppliers: [{ id: "s1", name: "Produce Co.", email: "" }],
    recipes: [
      {
        id: "r1",
        dishName: "Chicken Bowl",
        ingredients: [{ id: "ri1", itemName: "Chicken breast", quantity: "0.5", unit: "lb" }]
      }
    ],
    emailConnected: false
  });

  assert.equal(readiness.profileReady, true);
  assert.equal(readiness.inventoryReady, true);
  assert.equal(readiness.recipesReady, true);
  assert.equal(readiness.emailReady, false);
  assert.equal(readiness.currentStep, "email");
  assert.deepEqual(readiness.missingTasks, ["restaurant Gmail sender"]);
});

test("demo setup starter drafts make first-run onboarding reviewable", () => {
  const starter = createDemoSetupStarterDrafts();
  const readiness = buildSetupDraftReadiness({
    restaurantName: "Luna Bistro",
    cuisineType: "Fast casual",
    inventoryItems: starter.inventoryItems,
    suppliers: starter.suppliers,
    recipes: starter.recipes,
    emailConnected: false
  });
  const baseline = recipeDraftsToBaselineText(starter.recipes);

  assert.equal(starter.inventoryItems.length >= 3, true);
  assert.equal(starter.suppliers.length >= 2, true);
  assert.equal(starter.recipes.length >= 1, true);
  assert.equal(readiness.inventoryReady, true);
  assert.equal(readiness.recipesReady, true);
  assert.equal(readiness.currentStep, "email");
  assert.match(baseline, /Chicken Rice Bowl/);
  assert.match(baseline, /Chicken thigh 0\.42 lb/);
});

test("replaceable demo dataset seeds one year of stable restaurant data", () => {
  const state = createInitialDemoState("Toast", { preset: DEMO_DATASET.id });
  const restaurant = state.restaurants[0];
  assert.equal(restaurant?.name, DEMO_DATASET.restaurant.name);
  assert.equal((restaurant?.operational_profile.primarySuppliers.length ?? 0) >= 2, true);

  const distinctSaleDates = new Set(state.posSales.map((sale) => sale.sale_date));
  assert.equal(state.posSales.length, 318);
  assert.equal(distinctSaleDates.size, 53);
  assert.equal(state.posSales.some((sale) => sale.item_name === state.menuItemIngredients[0]?.menu_item_name), true);
  assert.equal(state.menuItemIngredients.length >= 6, true);

  const todaySummary = buildTodaySummary(
    restaurant!,
    state.posSales,
    state.inventoryItems,
    state.purchaseRecommendations,
    state.insights,
    state.menuItemIngredients
  );
  assert.equal(todayScreenTitle(restaurant?.name), `Today at ${DEMO_DATASET.restaurant.name}`);
  assert.equal(todaySummary.salesToday > 7500, true);
  assert.equal(todaySummary.salesTrend.length, 6);

  const memory = buildLearningMemorySummary(
    restaurant!,
    state.posSales,
    state.inventoryItems,
    state.purchaseRecommendations,
    state.insights,
    state.menuItemIngredients,
    state.supplierOrders
  );
  assert.match(memory.label, /reliable/i);
  assert.ok(memory.signals.some((signal) => signal.label === "Demand memory" && signal.value === "28d"));

  const draft = state.supplierOrders.find((order) => order.status === "draft");
  assert.ok(draft);
  const presentation = buildSupplierDraftPresentation(draft);
  assert.equal(presentation.itemCount > 0, true);
  assert.match(presentation.totalLabel ?? "", /\$/);
});

test("replaceable demo reset source restores draft and sent-history lanes", () => {
  const initial = createInitialDemoState("Toast", { preset: DEMO_DATASET.id });
  const reset = createInitialDemoState("Toast", { preset: DEMO_DATASET.id });

  initial.inventoryItems[0]!.current_quantity = 999;
  initial.supplierOrders = [];

  assert.notEqual(initial.inventoryItems[0]!.current_quantity, reset.inventoryItems[0]!.current_quantity);
  assert.equal(reset.supplierOrders.some((order) => order.status === "draft"), true);
  assert.equal(reset.supplierOrders.some((order) => order.status === "sent"), true);
  assert.equal(reset.salesImports[0]?.metadata.preset, DEMO_DATASET.id);
  assert.equal(reset.auditLogs[0]?.action, "demo_seeded");
});

test("recipe setup drafts convert to baseline text without empty rows", () => {
  const baseline = recipeDraftsToBaselineText([
    {
      id: "recipe_1",
      dishName: "Chicken Bowl",
      ingredients: [
        { id: "ingredient_1", itemName: "Chicken breast", quantity: "0.5", unit: "lb" },
        { id: "ingredient_2", itemName: "", quantity: "", unit: "lb" }
      ]
    },
    {
      id: "recipe_2",
      dishName: "",
      ingredients: [{ id: "ingredient_3", itemName: "Rice", quantity: "0.3", unit: "lb" }]
    }
  ]);

  assert.equal(baseline, "Chicken Bowl: Chicken breast 0.5 lb");
});

test("conditional analytics appear only when operational data supports them", () => {
  const state = createInitialDemoState("Toast");
  const empty = buildConditionalAnalyticsSummary(DEMO_RESTAURANT_ID, [], [], [], []);

  assert.equal(empty.canShowSalesRhythm, false);
  assert.equal(empty.canShowSupplierTrend, false);
  assert.equal(empty.canShowRecipeCoverage, false);

  const orders = [
    {
      id: "order_sent_1",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Local Produce Co.",
      order_message: "Order one",
      operator_note: null,
      status: "sent" as const,
      delivery_date: null,
      created_at: "2026-06-20T09:00:00.000Z"
    },
    {
      id: "order_sent_2",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_name: "Restaurant Depot",
      order_message: "Order two",
      operator_note: null,
      status: "completed" as const,
      delivery_date: null,
      created_at: "2026-06-21T09:00:00.000Z"
    }
  ];
  const ready = buildConditionalAnalyticsSummary(
    DEMO_RESTAURANT_ID,
    state.posSales,
    state.menuItemIngredients,
    state.inventoryItems,
    orders
  );

  assert.equal(ready.canShowSalesRhythm, true);
  assert.equal(ready.canShowSupplierTrend, true);
  assert.equal(ready.canShowRecipeCoverage, true);
  assert.equal(ready.supplierTrend.reduce((sum, point) => sum + point.orders, 0), 2);
});

test("supplier email payloads stay blocked until Gmail and recipient data are ready", () => {
  const state = createInitialDemoState("Toast");
  const restaurant = state.restaurants[0]!;
  const order = {
    id: "order_email_test",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_name: "Local Produce Co.",
    order_message: "Tomatoes - 20 lbs",
    operator_note: null,
    status: "draft" as const,
    delivery_date: null,
    created_at: "2026-06-21T09:00:00.000Z"
  };

  const blocked = buildSupplierEmailPayload(
    restaurant,
    order,
    state.emailConnections[0] ?? null,
    state.supplierRecipients
  );
  assert.equal(blocked.canSend, false);
  assert.match(blocked.blockedReason ?? "", /Gmail/i);

  const ready = buildSupplierEmailPayload(
    restaurant,
    order,
    {
      ...state.emailConnections[0]!,
      status: "connected",
      sender_email: "orders@mise-demo.example",
      last_verified_at: "2026-06-21T09:00:00.000Z"
    },
    state.supplierRecipients
  );
  assert.equal(ready.canSend, true);
  assert.equal(ready.to, "produce@local.example");
  assert.equal(ready.from, "orders@mise-demo.example");
  assert.match(ready.subject, /Local Produce/);
});

test("supplier order presentation itemizes current draft messages", () => {
  const lines = parseSupplierOrderLines(
    "Order draft for Local Produce Co.\n\nRoma Tomatoes - 20 lb\nRed Onions - 10 lb\n\nDelivery requested: Tomorrow morning\n\nNotes:\nRecommended based on recent sales and current inventory levels."
  );
  assert.deepEqual(lines, [
    { itemName: "Roma Tomatoes", quantityLabel: "20 lb", estimatedCents: 3260, priceLabel: "$32.60" },
    { itemName: "Red Onions", quantityLabel: "10 lb", estimatedCents: 1820, priceLabel: "$18.20" }
  ]);

  const presentation = buildSupplierDraftPresentation({
    id: "order_1",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_name: "Local Produce Co.",
    order_message: "Roma Tomatoes - 20 lb\nRed Onions - 10 lb",
    operator_note: null,
    status: "draft",
    delivery_date: "2026-06-23",
    created_at: "2026-06-22T10:00:00.000Z"
  });

  assert.equal(presentation.itemCount, 2);
  assert.equal(presentation.hiddenLineCount, 0);
  assert.equal(presentation.totalLabel, "$50.80");
  assert.match(presentation.deliveryCopy, /Due/);
});

test("today screen title personalizes to the active restaurant", () => {
  assert.equal(todayScreenTitle("Luna Bistro"), "Today at Luna Bistro");
  assert.equal(todayScreenTitle("  "), "Today at Mise");
  assert.equal(todayScreenTitle(null), "Today at Mise");
});

test("setup persistence preview counts durable tenant writes without raw attachment data", () => {
  const preview = buildSetupPersistencePreview({
    inventoryItems: [
      { id: "inventory_1", name: "Tomatoes", quantity: "20", unit: "lb", parLevel: "30", supplier: "Fresh Produce Co." },
      { id: "inventory_2", name: "", quantity: "4", unit: "case", parLevel: "8", supplier: "Dry Goods" }
    ],
    suppliers: [
      { id: "supplier_1", name: "Fresh Produce Co.", email: "orders@fresh.example" },
      { id: "supplier_2", name: "", email: "" }
    ],
    recipes: [
      {
        id: "recipe_1",
        dishName: "Tomato Salad",
        ingredients: [
          { id: "ingredient_1", itemName: "Tomatoes", quantity: "0.4", unit: "lb" },
          { id: "ingredient_2", itemName: "Olive Oil", quantity: "", unit: "oz" }
        ]
      }
    ],
    posSales: [
      {
        id: "pos_1",
        saleDate: "2026-06-30",
        itemName: "Tomato Salad",
        category: "Salads",
        quantitySold: 12,
        grossSales: 144,
        sourcePos: "Manual CSV Upload"
      }
    ],
    attachments: [
      { id: "attachment_1", kind: "screenshot", label: "Inventory screenshot queued for review", status: "review_needed" }
    ]
  });

  assert.deepEqual(preview, {
    inventoryItems: 1,
    suppliers: 1,
    recipeMappings: 1,
    posSalesRows: 1,
    attachmentMetadata: 1,
    metadataOnlyAttachments: true
  });
});

test("guided POS sales import accepts valid CSV rows and reports reviewable issues", () => {
  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      "2026-06-30,General Tso Chicken,Entrees,86,\"$1,290.00\"",
      "6/30/2026,Beef Lo Mein,Noodles,54,702",
      "2026-06-30,,Entrees,0,120"
    ].join("\n")
  );

  assert.equal(result.status, "needs_review");
  assert.equal(result.acceptedRowCount, 2);
  assert.equal(result.rejectedRowCount, 1);
  assert.equal(result.rows[0]?.saleDate, "2026-06-30");
  assert.equal(result.rows[0]?.grossSales, 1290);
  assert.equal(result.rows[1]?.grossSales, 702);
  assert.ok(result.issues.some((issue) => issue.field === "item_name"));
  assert.ok(result.issues.some((issue) => issue.field === "quantity_sold"));

  const firstOrder = parseSetupPosSalesCsv([
    "sale_date,item_name,category,quantity_sold,gross_sales",
    "2026-06-30,General Tso Chicken,Entrees,86,1290",
    "2026-06-30,Beef Lo Mein,Noodles,54,702"
  ].join("\n"));
  const reversedOrder = parseSetupPosSalesCsv([
    "sale_date,item_name,category,quantity_sold,gross_sales",
    "2026-06-30,Beef Lo Mein,Noodles,54,702",
    "2026-06-30,General Tso Chicken,Entrees,86,1290"
  ].join("\n"));
  assert.deepEqual(
    firstOrder.rows.map((row) => row.id).sort(),
    reversedOrder.rows.map((row) => row.id).sort(),
    "source identities remain stable when the same CSV rows are reordered"
  );

  const changed = parseSetupPosSalesCsv(
    "sale_date,item_name,category,quantity_sold,gross_sales\n2026-06-30,General Tso Chicken,Entrees,87,1290"
  );
  assert.notEqual(changed.rows[0]?.id, firstOrder.rows[0]?.id);
});

test("guided POS sales import rejects oversized and non-finite input", () => {
  const oversizedCharacters = parseSetupPosSalesCsv("x".repeat(256_001));
  assert.equal(oversizedCharacters.status, "needs_review");
  assert.match(oversizedCharacters.issues[0]?.message ?? "", /256,000 characters/);

  const header = "sale_date,item_name,category,quantity_sold,gross_sales";
  const oversizedRows = parseSetupPosSalesCsv([
    header,
    ...Array.from({ length: 1_001 }, (_, index) => `2026-07-13,Item ${index},Test,1,1`)
  ].join("\n"));
  assert.equal(oversizedRows.status, "needs_review");
  assert.match(oversizedRows.issues[0]?.message ?? "", /1,000 sales rows/);

  const invalidValues = parseSetupPosSalesCsv([
    header,
    "2026-07-13,Zero,Test,0,1",
    "2026-07-13,NaN,Test,NaN,1",
    "2026-07-13,Infinity,Test,Infinity,1",
    "2026-07-13,Over limit,Test,100001,1"
  ].join("\n"));
  assert.equal(invalidValues.acceptedRowCount, 0);
  assert.equal(invalidValues.rejectedRowCount, 4);
  assert.equal(invalidValues.issues.filter((issue) => issue.field === "quantity_sold").length, 4);
});

test("setup data health summarizes guided restaurant data without making POS or Gmail blocking", () => {
  const summary = buildSetupDataHealthSummary({
    restaurantName: DEMO_DATASET.restaurant.name,
    cuisineType: DEMO_DATASET.restaurant.cuisineType,
    inventoryItems: [
      { id: "i1", name: "Chicken thigh", quantity: "26", unit: "lb", parLevel: "95", supplier: "Regional Protein Co." },
      { id: "i2", name: "Jasmine rice", quantity: "88", unit: "lb", parLevel: "190", supplier: "Pantry Wholesale" },
      { id: "i3", name: "Bell peppers", quantity: "18", unit: "lb", parLevel: "52", supplier: "Metro Produce Supply" }
    ],
    suppliers: [{ id: "s1", name: "Metro Produce Supply", email: "orders@example.com" }],
    recipes: [
      {
        id: "r1",
        dishName: "General Tso Chicken",
        ingredients: [{ id: "ri1", itemName: "Chicken thigh", quantity: "0.42", unit: "lb" }]
      }
    ],
    posSales: [],
    emailConnected: false
  });

  assert.equal(summary.label, "Demo-ready");
  assert.equal(summary.signals.find((signal) => signal.id === "pos")?.value, "Sample ready");
  assert.match(summary.nextBestAction, /Paste a few POS rows|Open Today/);
});

test("setup completion audit metadata stays count-only and normalized", () => {
  const metadata = buildSetupCompletionAuditMetadata({
    inventoryItemsSaved: 4.8,
    supplierRecipientsSaved: 2,
    recipeMappingsSaved: Number.POSITIVE_INFINITY,
    posSalesRowsSaved: 3.9,
    attachmentMetadataSaved: -3,
    skippedRecipeIngredients: 1
  });

  assert.deepEqual(metadata, {
    inventory_items_saved: 4,
    supplier_recipients_saved: 2,
    recipe_mappings_saved: 0,
    pos_sales_rows_saved: 3,
    attachment_metadata_saved: 0,
    skipped_recipe_ingredients: 1
  });
  assert.equal(Object.keys(metadata).some((key) => /supplier_name|email|label|file|token|secret/i.test(key)), false);
});

test("structured AI insight contract rejects unbounded model output", () => {
  const parsed = parseStructuredInsightOutput({
    title: "Chicken prep is tight",
    summary: "Projected sales will pull chicken below par before dinner.",
    recommended_action: "Move chicken breast into the next supplier draft.",
    risk_level: "high",
    confidence: 0.82,
    affected_workflow: "inventory",
    evidence: ["Chicken coverage is below one day", "Sales trend is rising"]
  });

  assert.equal(parsed.risk_level, "high");
  assert.equal(structuredInsightJsonSchema.strict, true);
  assert.throws(() =>
    parseStructuredInsightOutput({
      title: "Missing fields",
      risk_level: "extreme"
    })
  );
});

test("POS adapters expose safe provider contracts without client secrets", async () => {
  const state = createInitialDemoState("Toast");
  const demoAdapter = getPosAdapter("demo");
  const toastAdapter = getPosAdapter("toast");

  const demoResult = await demoAdapter.syncSales(state.restaurants[0]!, {
    from: "2026-06-21T00:00:00.000Z",
    to: "2026-06-21T23:59:59.000Z"
  });

  assert.equal(demoResult.provider, "demo");
  assert.equal(toastAdapter.displayName, "Toast");
  await assert.rejects(
    () =>
      toastAdapter.syncSales(state.restaurants[0]!, {
        from: "2026-06-21T00:00:00.000Z",
        to: "2026-06-21T23:59:59.000Z"
      }),
    /server-side Edge Function/
  );
});
