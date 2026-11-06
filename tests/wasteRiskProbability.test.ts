import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import {
  WASTE_RISK_HOLDING_DAYS,
  computeWasteRiskProbability
} from "../services/domain/wasteRiskProbability";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("waste risk is zero when projected coverage sits at the eight-day holding window", () => {
  assert.equal(WASTE_RISK_HOLDING_DAYS, 8);
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 40,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0
  );
});

test("waste risk rises linearly once coverage exceeds the holding window", () => {
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 60,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0.5
  );
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 80,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    1
  );
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 120,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    1
  );
});

test("waste risk stays null without demand or when contaminated", () => {
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 80,
      averageDailyUsage: 0,
      contaminatedProjection: false
    }),
    null
  );
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 80,
      averageDailyUsage: 5,
      contaminatedProjection: true
    }),
    null
  );
});

test("waste risk rounds to hundredths for stable presentation", () => {
  assert.equal(
    computeWasteRiskProbability({
      projectedQuantity: 50,
      averageDailyUsage: 5,
      contaminatedProjection: false
    }),
    0.25
  );
});

test("buildInventoryPrediction exposes waste risk probability from coverage demand", () => {
  const restaurantId = "waste_risk_probability_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "waste_risk_probability_produce",
    restaurant_id: restaurantId,
    item_name: "Roma Tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 60,
    par_level: 24,
    reorder_threshold: 12,
    estimated_unit_cost: 2,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Local Produce",
    last_updated: new Date().toISOString()
  };
  const historicalSales = Array.from({ length: 8 }, (_, index) => ({
    id: `waste_risk_probability_history_${index}`,
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
        id: "waste_risk_probability_mapping",
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
  assert.equal(prediction.daysCoverage !== null, true);
  assert.equal(
    prediction.wasteRiskProbability,
    computeWasteRiskProbability({
      projectedQuantity: prediction.projectedQuantity,
      averageDailyUsage: prediction.averageDailyUsage,
      contaminatedProjection: false
    })
  );
});
