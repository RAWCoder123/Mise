import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import {
  EXPECTED_NEAR_TERM_USAGE_DAYS,
  computeExpectedNearTermUsage
} from "../services/domain/expectedNearTermUsage";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("expected near-term usage multiplies the daily rate by seven service days", () => {
  assert.equal(EXPECTED_NEAR_TERM_USAGE_DAYS, 7);
  assert.equal(
    computeExpectedNearTermUsage({
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    35
  );
  assert.equal(
    computeExpectedNearTermUsage({
      averageDailyUsage: 2.5,
      contaminatedProjection: false
    }),
    17.5
  );
});

test("expected near-term usage stays null without demand or when contaminated", () => {
  assert.equal(
    computeExpectedNearTermUsage({
      averageDailyUsage: 0,
      contaminatedProjection: false
    }),
    null
  );
  assert.equal(
    computeExpectedNearTermUsage({
      averageDailyUsage: 5,
      contaminatedProjection: true
    }),
    null
  );
});

test("expected near-term usage rounds to hundredths for stable presentation", () => {
  assert.equal(
    computeExpectedNearTermUsage({
      averageDailyUsage: 1.333,
      contaminatedProjection: false
    }),
    9.33
  );
});

test("buildInventoryPrediction exposes expected near-term usage from demand rate", () => {
  const restaurantId = "expected_near_term_usage_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "expected_near_term_usage_produce",
    restaurant_id: restaurantId,
    item_name: "Roma Tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 40,
    par_level: 24,
    reorder_threshold: 12,
    estimated_unit_cost: 2,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Local Produce",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `expected_near_term_usage_history_${index}`,
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
        id: "expected_near_term_usage_mapping",
        restaurant_id: restaurantId,
        menu_item_name: "Tomato Salad",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.25,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.equal(prediction.averageDailyUsage > 0, true);
  assert.equal(
    prediction.expectedNearTermUsage,
    computeExpectedNearTermUsage({
      averageDailyUsage: prediction.averageDailyUsage,
      contaminatedProjection: false
    })
  );
});
