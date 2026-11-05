import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { computeSuggestedOrderByDate } from "../services/domain/suggestedOrderByDate";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("order-by date is today when projected on-hand is already at reorder", () => {
  const result = computeSuggestedOrderByDate({
    operatingDate: "2026-11-05",
    projectedQuantity: 10,
    reorderThreshold: 12,
    averageDailyUsage: 5,
    suggestedOrderQuantity: 20,
    contaminatedProjection: false
  });
  assert.equal(result.daysUntilSuggestedOrder, 0);
  assert.equal(result.suggestedOrderByDate, "2026-11-05");
});

test("order-by date advances by whole days until reorder threshold", () => {
  const result = computeSuggestedOrderByDate({
    operatingDate: "2026-11-05",
    projectedQuantity: 30,
    reorderThreshold: 10,
    averageDailyUsage: 5,
    suggestedOrderQuantity: 20,
    contaminatedProjection: false
  });
  assert.equal(result.daysUntilSuggestedOrder, 4);
  assert.equal(result.suggestedOrderByDate, "2026-11-09");
});

test("order-by date stays null without demand, without order quantity, or when contaminated", () => {
  assert.equal(
    computeSuggestedOrderByDate({
      operatingDate: "2026-11-05",
      projectedQuantity: 30,
      reorderThreshold: 10,
      averageDailyUsage: 0,
      suggestedOrderQuantity: 20,
      contaminatedProjection: false
    }).suggestedOrderByDate,
    null
  );
  assert.equal(
    computeSuggestedOrderByDate({
      operatingDate: "2026-11-05",
      projectedQuantity: 80,
      reorderThreshold: 10,
      averageDailyUsage: 5,
      suggestedOrderQuantity: 0,
      contaminatedProjection: false
    }).suggestedOrderByDate,
    null
  );
  assert.equal(
    computeSuggestedOrderByDate({
      operatingDate: "2026-11-05",
      projectedQuantity: 30,
      reorderThreshold: 10,
      averageDailyUsage: 5,
      suggestedOrderQuantity: 20,
      contaminatedProjection: true
    }).suggestedOrderByDate,
    null
  );
});

test("buildInventoryPrediction exposes order-by date from coverage demand", () => {
  const restaurantId = "order_by_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "order_by_chicken",
    restaurant_id: restaurantId,
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 40,
    par_level: 50,
    reorder_threshold: 10,
    estimated_unit_cost: 4,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Fresh Co.",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `order_by_history_${index}`,
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
  const prediction = buildInventoryPrediction(
    item,
    historicalSales,
    [
      {
        id: "order_by_mapping",
        restaurant_id: restaurantId,
        menu_item_name: "Chicken Bowl",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.5,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.ok(prediction.averageDailyUsage > 0);
  assert.ok(prediction.suggestedOrderQuantity > 0);
  assert.ok(prediction.suggestedOrderByDate);
  assert.match(prediction.suggestedOrderByDate!, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(prediction.daysUntilSuggestedOrder !== null);
  assert.ok(prediction.daysUntilSuggestedOrder! >= 0);
});
