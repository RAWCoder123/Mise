import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { computeBaselineDailyUsage } from "../services/domain/baselineDailyUsage";
import { contaminatedInventoryCountEvidence } from "../services/domain/inventoryCountAuthority";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("baseline daily usage rounds a positive historical rate to hundredths", () => {
  assert.equal(
    computeBaselineDailyUsage({
      contaminatedProjection: false,
      baselineUsage: 10
    }),
    10
  );
  assert.equal(
    computeBaselineDailyUsage({
      contaminatedProjection: false,
      baselineUsage: 2.567
    }),
    2.57
  );
});

test("baseline daily usage stays null without a positive baseline or when contaminated", () => {
  assert.equal(
    computeBaselineDailyUsage({
      contaminatedProjection: false,
      baselineUsage: 0
    }),
    null
  );
  assert.equal(
    computeBaselineDailyUsage({
      contaminatedProjection: true,
      baselineUsage: 10
    }),
    null
  );
  assert.equal(
    computeBaselineDailyUsage({
      contaminatedProjection: false,
      baselineUsage: Number.NaN
    }),
    null
  );
  assert.equal(
    computeBaselineDailyUsage({
      contaminatedProjection: false,
      baselineUsage: -1
    }),
    null
  );
});

test("buildInventoryPrediction exposes baseline daily usage from restaurant history", () => {
  const restaurantId = "baseline_daily_usage_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "baseline_daily_usage_produce",
    restaurant_id: restaurantId,
    item_name: "Roma Tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 24,
    par_level: 30,
    reorder_threshold: 12,
    estimated_unit_cost: 2,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Local Produce",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `baseline_daily_usage_history_${index}`,
    restaurant_id: restaurantId,
    sale_date: toDateKey(addDays(new Date(), -(index + 1))),
    item_name: "Tomato Salad",
    category: "Appetizer",
    quantity_sold: 10,
    gross_sales: 80,
    net_sales: 74,
    source_pos: "Test POS",
    created_at: new Date().toISOString()
  }));
  const prediction = buildInventoryPrediction(
    item,
    [
      ...historicalSales,
      {
        id: "baseline_daily_usage_today",
        restaurant_id: restaurantId,
        sale_date: operatingDate,
        item_name: "Tomato Salad",
        category: "Appetizer",
        quantity_sold: 20,
        gross_sales: 160,
        net_sales: 148,
        source_pos: "Test POS",
        created_at: new Date().toISOString()
      }
    ],
    [
      {
        id: "baseline_daily_usage_recipe",
        restaurant_id: restaurantId,
        menu_item_name: "Tomato Salad",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.5,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.equal(prediction.historySource, "restaurant_history");
  assert.ok(prediction.baselineDailyUsage !== null);
  assert.ok(prediction.baselineDailyUsage! > 0);
  // Blended average pulls toward today's hotter mapped usage; baseline stays
  // the historical rate so operators can see "usual" beside the blend.
  assert.ok(prediction.averageDailyUsage > prediction.baselineDailyUsage!);
});

test("buildInventoryPrediction keeps baseline daily usage null for contaminated projections", () => {
  const restaurantId = "baseline_daily_usage_contaminated_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "baseline_daily_usage_contaminated_item",
    restaurant_id: restaurantId,
    item_name: "Heavy Cream",
    category: "Dairy",
    unit: "qt",
    current_quantity: 4,
    par_level: 8,
    reorder_threshold: 3,
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
  assert.equal(prediction.baselineDailyUsage, null);
});

test("buildInventoryPrediction keeps baseline daily usage null when Mise is still learning", () => {
  const restaurantId = "baseline_daily_usage_learning_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "baseline_daily_usage_learning_item",
    restaurant_id: restaurantId,
    item_name: "Parsley",
    category: "Produce",
    unit: "bunch",
    current_quantity: 6,
    par_level: 8,
    reorder_threshold: 3,
    estimated_unit_cost: 1,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Local Produce",
    last_updated: new Date().toISOString()
  };
  const prediction = buildInventoryPrediction(item, [], [], operatingDate);

  assert.equal(prediction.historySource, "none");
  assert.equal(prediction.baselineDailyUsage, null);
});
