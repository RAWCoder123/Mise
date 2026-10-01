import assert from "node:assert/strict";
import test from "node:test";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { ReceiveDiscrepancySample } from "../services/domain/receiveDiscrepancyLearning";

const restaurantId = "restaurant-1";
const itemId = "item-avocados";
const supplierId = "supplier-fresh";

function chronicSamples(): ReceiveDiscrepancySample[] {
  return [20, 18, 16, 14].map((day, index) => ({
    inventoryItemId: itemId,
    quantityOrdered: 10,
    quantityReceived: index % 2 === 0 ? 7 : 8,
    discrepancy: index % 2 === 0 ? -3 : -2,
    createdAt: `2026-08-${day}T12:00:00.000Z`,
    supplierOrderId: `order-${day}`
  }));
}

function baseSnapshot(receivingHistory: ReceiveDiscrepancySample[]) {
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
    receivingHistory
  };
}

test("calculateOperationalSignals pads low-stock qty for chronic short-ships", () => {
  const { recommendations, insights } = calculateOperationalSignals(baseSnapshot(chronicSamples()));

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.recommended_quantity, 23);
  assert.match(recommendations[0]?.reason ?? "", /short-ship pattern/i);
  assert.ok(
    insights.some(
      (insight) =>
        insight.presentation.code === "insight.rule.ordering.chronic_short_ship" &&
        insight.insight_type === "ordering"
    )
  );
});

test("calculateOperationalSignals leaves qty unchanged without chronic short-ships", () => {
  const { recommendations } = calculateOperationalSignals(baseSnapshot([]));

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0]?.recommended_quantity, 18);
  assert.doesNotMatch(recommendations[0]?.reason ?? "", /short-ship/i);
});
