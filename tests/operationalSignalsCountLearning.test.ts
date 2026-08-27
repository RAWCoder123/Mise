import assert from "node:assert/strict";
import test from "node:test";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { PurchaseLoopCountSample } from "../services/domain/purchaseLoopLearning";

const restaurantId = "restaurant-1";
const itemId = "item-avocados";
const supplierId = "supplier-fresh";

function chronicSamples(): PurchaseLoopCountSample[] {
  return [20, 18, 16, 14].map((day, index) => ({
    inventoryItemId: itemId,
    systemQuantityAtStart: 10,
    countedQuantity: index % 2 === 0 ? 7 : 8,
    varianceFromSystem: index % 2 === 0 ? -3 : -2,
    measuredAt: `2026-08-${day}T12:00:00.000Z`,
    countSessionId: `count-${day}`,
    supplierOrderId: `order-${day}`
  }));
}

function baseSnapshot(purchaseLoopCountHistory: PurchaseLoopCountSample[]) {
  return {
    restaurantId,
    operatingDate: "2026-08-27",
    timeZone: "UTC",
    inventoryItems: [
      {
        id: itemId,
        restaurant_id: restaurantId,
        item_name: "Avocados",
        supplier_id: supplierId,
        supplier_name: "Fresh Farms",
        unit: "ea",
        current_quantity: 2,
        par_level: 20,
        reorder_threshold: 8,
        last_updated: "2026-08-27T12:00:00.000Z"
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    inventoryLedgerEvents: [
      {
        restaurantId,
        inventoryItemId: itemId,
        eventType: "count",
        effectiveAt: "2026-08-26T22:00:00.000Z",
        sequence: 1
      }
    ],
    purchaseLoopCountHistory
  };
}

test("calculateOperationalSignals pads low-stock qty for chronic count shorts", () => {
  const { recommendations, insights } = calculateOperationalSignals(baseSnapshot(chronicSamples()));

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.recommended_quantity, 23);
  assert.match(recommendations[0]?.reason ?? "", /post-receive count shortfall/i);
  assert.ok(
    insights.some(
      (insight) =>
        insight.presentation.code === "insight.rule.ordering.chronic_count_short" &&
        insight.insight_type === "ordering"
    )
  );
});

test("calculateOperationalSignals leaves qty unchanged without chronic count shorts", () => {
  const { recommendations } = calculateOperationalSignals(baseSnapshot([]));

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.recommended_quantity, 18);
  assert.doesNotMatch(recommendations[0]?.reason ?? "", /post-receive count shortfall/i);
});
