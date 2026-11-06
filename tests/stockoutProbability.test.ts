import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import {
  STOCKOUT_PROBABILITY_HORIZON_DAYS,
  computeStockoutProbability
} from "../services/domain/stockoutProbability";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("stockout probability is certain when projected on-hand is already at zero", () => {
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 0,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    1
  );
});

test("stockout probability declines linearly across the two-day coverage horizon", () => {
  assert.equal(STOCKOUT_PROBABILITY_HORIZON_DAYS, 2);
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 5,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0.5
  );
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 10,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0
  );
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 20,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0
  );
});

test("stockout probability stays null without demand or when contaminated", () => {
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 30,
      averageDailyUsage: 0,
      contaminatedProjection: false
    }),
    null
  );
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 30,
      averageDailyUsage: 5,
      contaminatedProjection: true
    }),
    null
  );
});

test("stockout probability rounds to hundredths for stable presentation", () => {
  assert.equal(
    computeStockoutProbability({
      projectedQuantity: 7,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0.3
  );
});

test("buildInventoryPrediction exposes stockout probability from coverage demand", () => {
  const restaurantId = "stockout_probability_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "stockout_probability_chicken",
    restaurant_id: restaurantId,
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 5,
    par_level: 50,
    reorder_threshold: 10,
    estimated_unit_cost: 4,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Fresh Co.",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `stockout_probability_history_${index}`,
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
        id: "stockout_probability_mapping",
        restaurant_id: restaurantId,
        menu_item_name: "Chicken Bowl",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.25,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.equal(prediction.averageDailyUsage > 0, true);
  assert.equal(prediction.daysCoverage !== null, true);
  assert.equal(
    prediction.stockoutProbability,
    computeStockoutProbability({
      projectedQuantity: prediction.projectedQuantity,
      averageDailyUsage: prediction.averageDailyUsage,
      contaminatedProjection: false
    })
  );
});
