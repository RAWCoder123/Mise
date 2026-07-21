import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftsFromRecommendations,
  buildInventoryControlSummary,
  buildInventoryOutlooks,
  buildInventoryPrediction,
  buildRecommendationInserts,
  buildTodaySummary,
  rebuildPurchaseRecommendations,
  shouldSuppressRecommendationForItem
} from "../services/domain/miseDomain";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { inventoryUnitsAreCompatible } from "../services/domain/inventoryUnits";
import { buildRecordedSalesTrend } from "../services/domain/salesTrends";
import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID
} from "../services/demoData";
import type {
  InventoryItem,
  MenuItemIngredient,
  PosSale,
  PurchaseRecommendation
} from "../types/mise";
import { nextDateKeyInTimeZone } from "../utils/format";

const operatingDate = "2026-07-14";
const fixedNow = "2026-07-14T12:00:00.000Z";

function inventoryItem(
  id: string,
  restaurantId: string,
  currentQuantity: number,
  category = "Other"
): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: id,
    category,
    unit: "lb",
    current_quantity: currentQuantity,
    par_level: 20,
    reorder_threshold: 10,
    estimated_unit_cost: 1,
    supplier_name: "Supplier",
    last_updated: fixedNow
  };
}

function approvedRecommendation(
  id: string,
  restaurantId: string,
  supplierName: string,
  itemName: string,
  status: PurchaseRecommendation["status"] = "approved"
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: restaurantId,
    inventory_item_id: `item_${id}`,
    item_name: itemName,
    supplier_name: supplierName,
    recommended_quantity: 2.5,
    unit: "lb",
    reason: "Count is below the operating threshold.",
    urgency: "medium",
    status,
    supplier_order_id: null,
    created_at: fixedNow
  };
}

test("inventory health reconciles every status and treats an empty tenant as zero percent", () => {
  const restaurantId = "restaurant-health";
  const otherRestaurantId = "restaurant-other";
  const items = [
    inventoryItem("good", restaurantId, 25, "Protein"),
    inventoryItem("watch", restaurantId, 15, "Produce"),
    inventoryItem("low", restaurantId, 9, "Dry goods"),
    inventoryItem("critical", restaurantId, 5, "Dairy"),
    inventoryItem("foreign-good", otherRestaurantId, 25, "Protein")
  ];
  const outlooks = [
    ...buildInventoryOutlooks(restaurantId, items, [], [], operatingDate),
    ...buildInventoryOutlooks(otherRestaurantId, items, [], [], operatingDate)
  ];

  const summary = buildInventoryControlSummary(restaurantId, outlooks);
  assert.equal(summary.itemCount, 4);
  assert.equal(summary.wellStockedPercent, 25);
  assert.deepEqual(
    [summary.stableCount, summary.watchCount, summary.lowCount, summary.criticalCount],
    [1, 1, 1, 1]
  );
  assert.equal(
    summary.stableCount + summary.watchCount + summary.lowCount + summary.criticalCount,
    summary.itemCount
  );
  assert.equal(summary.needOrderCount, 2);

  const empty = buildInventoryControlSummary("restaurant-empty", outlooks);
  assert.equal(empty.itemCount, 0);
  assert.equal(empty.wellStockedPercent, 0);
  assert.equal(empty.needOrderCount, 0);
  assert.equal(empty.stableCount + empty.watchCount + empty.lowCount + empty.criticalCount, 0);
});

test("default demo presents a balanced kitchen, a real reorder, and healthy sales movement", () => {
  const now = new Date(fixedNow);
  const state = createInitialDemoState("Toast", { preset: "default" }, now);
  const restaurant = state.restaurants[0]!;
  const outlooks = buildInventoryOutlooks(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    operatingDate
  );
  const inventory = buildInventoryControlSummary(DEMO_RESTAURANT_ID, outlooks);

  assert.deepEqual(
    [inventory.stableCount, inventory.watchCount, inventory.lowCount, inventory.criticalCount],
    [4, 1, 1, 1]
  );
  assert.equal(inventory.wellStockedPercent, 57);

  const recommendations = buildRecommendationInserts(
    DEMO_RESTAURANT_ID,
    state.inventoryItems,
    state.posSales,
    state.menuItemIngredients,
    state.purchaseRecommendations,
    operatingDate
  );
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.item_name, "Chicken thigh");
  assert.equal(recommendations[0]?.urgency, "high");

  const today = buildTodaySummary(
    restaurant,
    state.posSales,
    state.inventoryItems,
    state.purchaseRecommendations,
    state.insights,
    state.menuItemIngredients,
    operatingDate
  );
  const currentSales = today.salesTrend.at(-1)?.sales ?? 0;
  const previousSales = today.salesTrend.at(-2)?.sales ?? 0;
  const movement = previousSales > 0 ? (currentSales - previousSales) / previousSales : 0;
  assert.ok(movement >= 0.07 && movement <= 0.1, `expected +7% to +10%, received ${movement}`);

  assert.deepEqual(
    state.supplierOrders.map((order) => order.delivery_date).sort(),
    [operatingDate, nextDateKeyInTimeZone(now, restaurant.timezone)].sort()
  );
});

test("recorded sales trends stay tenant-scoped and never invent missing or future service days", () => {
  const restaurantId = "restaurant-sales";
  const sale = (id: string, date: string, grossSales: number, tenant = restaurantId): PosSale => ({
    id,
    restaurant_id: tenant,
    sale_date: date,
    item_name: "Dinner",
    category: "Entree",
    quantity_sold: 1,
    gross_sales: grossSales,
    net_sales: grossSales,
    source_pos: "Test POS",
    created_at: fixedNow
  });

  const trend = buildRecordedSalesTrend(
    restaurantId,
    [
      sale("first", "2026-07-10", 100),
      sale("same-day", "2026-07-10", 25.555),
      sale("gap", "2026-07-12", 80),
      sale("future", "2026-07-15", 999),
      sale("negative", "2026-07-11", -20),
      sale("invalid-date", "07/13/2026", 100),
      sale("invalid-calendar-date", "2026-02-31", 100),
      sale("foreign", "2026-07-13", 500, "restaurant-other")
    ],
    { throughDate: "2026-07-14", limit: 7 }
  );

  assert.deepEqual(trend, [
    { date: "2026-07-10", sales: 125.56 },
    { date: "2026-07-12", sales: 80 }
  ]);
});

test("prediction boundaries ignore wrong dates, anomalous quantities, and incompatible units before rounding", () => {
  const restaurantId = "restaurant-prediction";
  const item: InventoryItem = {
    ...inventoryItem("tomatoes", restaurantId, 20, "Produce"),
    item_name: "Tomatoes",
    par_level: 25,
    reorder_threshold: 19
  };
  const sale = (id: string, saleDate: string, quantitySold: number, tenant = restaurantId): PosSale => ({
    id,
    restaurant_id: tenant,
    sale_date: saleDate,
    item_name: "Tomato Bowl",
    category: "Entree",
    quantity_sold: quantitySold,
    gross_sales: 10,
    net_sales: 9,
    source_pos: "Test POS",
    created_at: fixedNow
  });
  const mapping = (id: string, quantity: number, unit: string): MenuItemIngredient => ({
    id,
    restaurant_id: restaurantId,
    menu_item_name: "Tomato Bowl",
    inventory_item_id: item.id,
    quantity_used_per_sale: quantity,
    unit
  });
  const sales = [
    sale("today", operatingDate, 3),
    sale("negative", operatingDate, -100),
    sale("nan", operatingDate, Number.NaN),
    sale("infinite", operatingDate, Number.POSITIVE_INFINITY),
    sale("yesterday", "2026-07-13", 1_000),
    sale("tomorrow", "2026-07-15", 1_000),
    sale("foreign", operatingDate, 1_000, "restaurant-other")
  ];
  const mappings = [
    mapping("compatible", 0.5, "pounds"),
    mapping("wrong-unit", 16, "oz"),
    mapping("invalid-quantity", Number.NaN, "lb")
  ];

  assert.equal(inventoryUnitsAreCompatible(" LB ", "pounds"), true);
  assert.equal(inventoryUnitsAreCompatible("units", "ea"), true);
  assert.equal(inventoryUnitsAreCompatible("lb", "oz"), false);

  const prediction = buildInventoryPrediction(item, sales, mappings, operatingDate);
  assert.equal(prediction.todayDepletion, 1.5);
  assert.equal(prediction.projectedQuantity, 18.5);
  assert.equal(prediction.projectedStatus, "Low");
  assert.equal(prediction.suggestedOrderQuantity, 7);
  assert.ok(Number.isFinite(prediction.averageDailyUsage));
  assert.ok(Number.isFinite(prediction.suggestedOrderQuantity));

  const operational = calculateOperationalSignals({
    restaurantId,
    operatingDate,
    inventoryItems: [item],
    sales,
    menuItemIngredients: mappings,
    recommendationHistory: []
  });
  assert.equal(operational.recommendations.length, 1);
  assert.equal(operational.recommendations[0]?.recommended_quantity, 7);
  assert.equal(operational.recommendations[0]?.urgency, "medium");
});

test("supplier grouping is tenant-safe and uses the restaurant calendar for tomorrow", () => {
  const restaurantId = "restaurant-orders";
  const instant = new Date("2026-07-14T02:30:00.000Z");
  assert.equal(nextDateKeyInTimeZone(instant, "America/New_York"), "2026-07-14");
  assert.equal(nextDateKeyInTimeZone(instant, "Asia/Tokyo"), "2026-07-15");

  const drafts = buildDraftsFromRecommendations(
    restaurantId,
    [
      approvedRecommendation("zucchini", restaurantId, "Fresh Foods", "Zucchini"),
      approvedRecommendation("apples", restaurantId, "Fresh Foods", "Apples"),
      approvedRecommendation("rice", restaurantId, "Pantry Co.", "Rice"),
      approvedRecommendation("pending", restaurantId, "Fresh Foods", "Pending", "pending"),
      approvedRecommendation("foreign", "restaurant-other", "Fresh Foods", "Foreign item")
    ],
    { now: instant, timeZone: "America/New_York" }
  );

  assert.equal(drafts.length, 2);
  assert.ok(drafts.every((draft) => draft.restaurant_id === restaurantId));
  assert.ok(drafts.every((draft) => draft.delivery_date === "2026-07-14"));
  assert.ok(drafts.every((draft) => draft.created_at === instant.toISOString()));
  const produceDraft = drafts.find((draft) => draft.supplier_name === "Fresh Foods");
  assert.ok(produceDraft);
  assert.ok(produceDraft.order_message.indexOf("Apples") < produceDraft.order_message.indexOf("Zucchini"));
  assert.doesNotMatch(produceDraft.order_message, /Pending|Foreign item/);
});

test("equal-timestamp handling suppresses duplicates and recommendation rebuilds are replay-safe", () => {
  const restaurantId = "restaurant-suppression";
  const item = inventoryItem("low-item", restaurantId, 5);
  const handled = approvedRecommendation("handled", restaurantId, "Supplier", item.item_name, "dismissed");
  handled.inventory_item_id = item.id;
  handled.created_at = item.last_updated;

  assert.equal(shouldSuppressRecommendationForItem(restaurantId, item, [handled]), true);
  assert.equal(shouldSuppressRecommendationForItem("restaurant-other", item, [handled]), false);

  const state = createInitialDemoState("Toast");
  state.purchaseRecommendations = [];
  rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID);
  const firstPending = state.purchaseRecommendations
    .filter((recommendation) => recommendation.status === "pending")
    .map((recommendation) => [recommendation.id, recommendation.inventory_item_id]);
  assert.ok(firstPending.length > 0);

  rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID);
  const secondPending = state.purchaseRecommendations
    .filter((recommendation) => recommendation.status === "pending")
    .map((recommendation) => [recommendation.id, recommendation.inventory_item_id]);
  assert.deepEqual(secondPending, firstPending);
  assert.equal(new Set(secondPending.map(([, inventoryItemId]) => inventoryItemId)).size, secondPending.length);
});
