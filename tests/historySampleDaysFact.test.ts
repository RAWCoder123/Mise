import assert from "node:assert/strict";
import test from "node:test";

import { contaminatedInventoryCountEvidence } from "../services/domain/inventoryCountAuthority";
import { computeHistorySampleDaysFact } from "../services/domain/historySampleDaysFact";
import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("history sample days fact returns floor of positive restaurant-history samples", () => {
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: 14
    }),
    14
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: 7.9
    }),
    7
  );
});

test("history sample days fact stays null without restaurant history or when contaminated", () => {
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "demo_fallback",
      historySampleDays: 14
    }),
    null
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "current_day",
      historySampleDays: 1
    }),
    null
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "none",
      historySampleDays: 0
    }),
    null
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: true,
      historySource: "restaurant_history",
      historySampleDays: 14
    }),
    null
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: 0
    }),
    null
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: Number.NaN
    }),
    null
  );
  assert.equal(
    computeHistorySampleDaysFact({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: -3
    }),
    null
  );
});

test("buildInventoryPrediction exposes history sample days fact from restaurant history", () => {
  const restaurantId = "history_sample_days_fact_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "history_sample_days_fact_produce",
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
    id: `history_sample_days_fact_history_${index}`,
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
    historicalSales,
    [
      {
        id: "history_sample_days_fact_recipe",
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
  assert.ok(prediction.historySampleDays > 0);
  assert.equal(prediction.historySampleDaysFact, prediction.historySampleDays);
});

test("buildInventoryPrediction keeps history sample days fact null for contaminated projections", () => {
  const restaurantId = "history_sample_days_fact_contaminated_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "history_sample_days_fact_contaminated_item",
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
  assert.equal(prediction.historySampleDaysFact, null);
});

test("buildInventoryPrediction keeps history sample days fact null when Mise is still learning", () => {
  const restaurantId = "history_sample_days_fact_learning_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "history_sample_days_fact_learning_item",
    restaurant_id: restaurantId,
    item_name: "Basil",
    category: "Produce",
    unit: "oz",
    current_quantity: 12,
    par_level: 16,
    reorder_threshold: 6,
    estimated_unit_cost: 1,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Herb Farm",
    last_updated: new Date().toISOString()
  };
  const prediction = buildInventoryPrediction(item, [], [], operatingDate);

  assert.equal(prediction.historySource, "none");
  assert.equal(prediction.historySampleDays, 0);
  assert.equal(prediction.historySampleDaysFact, null);
});
