import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { computeSuggestedOrderQuantityFact } from "../services/domain/suggestedOrderQuantityFact";
import { contaminatedInventoryCountEvidence } from "../services/domain/inventoryCountAuthority";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("suggested order quantity fact matches the order quantity for Critical and Low", () => {
  assert.equal(
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: false,
      projectedStatus: "Critical",
      suggestedOrderQuantity: 18
    }),
    18
  );
  assert.equal(
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: false,
      projectedStatus: "Low",
      suggestedOrderQuantity: 6.5
    }),
    6.5
  );
});

test("suggested order quantity fact stays null when no order is warranted", () => {
  assert.equal(
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: false,
      projectedStatus: "Watch",
      suggestedOrderQuantity: 1
    }),
    null
  );
  assert.equal(
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: false,
      projectedStatus: "Good",
      suggestedOrderQuantity: 1
    }),
    null
  );
  assert.equal(
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: false,
      projectedStatus: "Critical",
      suggestedOrderQuantity: 0
    }),
    null
  );
});

test("suggested order quantity fact stays null when the projection is contaminated", () => {
  assert.equal(
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: true,
      projectedStatus: "Critical",
      suggestedOrderQuantity: 18
    }),
    null
  );
});

test("buildInventoryPrediction exposes suggested order quantity fact for Critical stock", () => {
  const restaurantId = "suggested_order_quantity_fact_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "suggested_order_quantity_fact_produce",
    restaurant_id: restaurantId,
    item_name: "Roma Tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 2,
    par_level: 24,
    reorder_threshold: 12,
    estimated_unit_cost: 2,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Local Produce",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `suggested_order_quantity_fact_history_${index}`,
    restaurant_id: restaurantId,
    sale_date: toDateKey(addDays(new Date(), -(index + 1))),
    item_name: "Tomato Salad",
    category: "Appetizer",
    quantity_sold: 20,
    gross_sales: 160,
    net_sales: 148,
    source_pos: "Test POS",
    created_at: new Date().toISOString()
  }));
  const prediction = buildInventoryPrediction(
    item,
    historicalSales,
    [
      {
        id: "suggested_order_quantity_fact_mapping",
        restaurant_id: restaurantId,
        menu_item_name: "Tomato Salad",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.25,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.equal(prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low", true);
  assert.equal(prediction.suggestedOrderQuantity > 0, true);
  assert.equal(
    prediction.suggestedOrderQuantityFact,
    computeSuggestedOrderQuantityFact({
      contaminatedProjection: false,
      projectedStatus: prediction.projectedStatus,
      suggestedOrderQuantity: prediction.suggestedOrderQuantity
    })
  );
  assert.equal(prediction.suggestedOrderQuantityFact, prediction.suggestedOrderQuantity);
});

test("buildInventoryPrediction nulls suggested order quantity fact when contaminated", () => {
  const restaurantId = "suggested_order_quantity_fact_contaminated";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "suggested_order_quantity_fact_contaminated_item",
    restaurant_id: restaurantId,
    item_name: "Heavy Cream",
    category: "Dairy",
    unit: "qt",
    current_quantity: 1,
    par_level: 10,
    reorder_threshold: 4,
    estimated_unit_cost: 3,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Dairy Co",
    last_updated: new Date().toISOString()
  };
  const prediction = buildInventoryPrediction(
    item,
    [],
    [],
    operatingDate,
    undefined,
    undefined,
    contaminatedInventoryCountEvidence(restaurantId, item.id)
  );

  assert.equal(prediction.countEvidence, "contaminated_projection");
  assert.equal(prediction.suggestedOrderQuantityFact, null);
});
