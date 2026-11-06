import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { computeProjectedStockoutDate } from "../services/domain/projectedStockoutDate";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("stockout date is today when projected on-hand is already at zero", () => {
  const result = computeProjectedStockoutDate({
    operatingDate: "2026-11-06",
    projectedQuantity: 0,
    averageDailyUsage: 5,
    contaminatedProjection: false
  });
  assert.equal(result.daysUntilStockout, 0);
  assert.equal(result.projectedStockoutDate, "2026-11-06");
});

test("stockout date advances by whole days until projected on-hand reaches zero", () => {
  const result = computeProjectedStockoutDate({
    operatingDate: "2026-11-06",
    projectedQuantity: 22,
    averageDailyUsage: 5,
    contaminatedProjection: false
  });
  assert.equal(result.daysUntilStockout, 4.4);
  assert.equal(result.projectedStockoutDate, "2026-11-10");
});

test("stockout date stays null without demand or when contaminated", () => {
  assert.equal(
    computeProjectedStockoutDate({
      operatingDate: "2026-11-06",
      projectedQuantity: 30,
      averageDailyUsage: 0,
      contaminatedProjection: false
    }).projectedStockoutDate,
    null
  );
  assert.equal(
    computeProjectedStockoutDate({
      operatingDate: "2026-11-06",
      projectedQuantity: 30,
      averageDailyUsage: 5,
      contaminatedProjection: true
    }).projectedStockoutDate,
    null
  );
  assert.equal(
    computeProjectedStockoutDate({
      operatingDate: "not-a-date",
      projectedQuantity: 30,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }).projectedStockoutDate,
    null
  );
});

test("stockout date remains available even when no reorder quantity is suggested", () => {
  const result = computeProjectedStockoutDate({
    operatingDate: "2026-11-06",
    projectedQuantity: 40,
    averageDailyUsage: 5,
    contaminatedProjection: false
  });
  assert.equal(result.daysUntilStockout, 8);
  assert.equal(result.projectedStockoutDate, "2026-11-14");
});

test("buildInventoryPrediction exposes stockout date from coverage demand", () => {
  const restaurantId = "stockout_date_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "stockout_chicken",
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
    id: `stockout_history_${index}`,
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
        id: "stockout_mapping",
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
  assert.ok(prediction.projectedStockoutDate);
  assert.match(prediction.projectedStockoutDate!, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(prediction.daysUntilStockout !== null);
  assert.ok(prediction.daysUntilStockout! >= 0);
});
