import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import {
  FORECAST_CONFIDENCE_CEILING,
  computeForecastConfidence
} from "../services/domain/forecastConfidence";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("forecast confidence stays null when the projection is contaminated", () => {
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: true,
      historySource: "restaurant_history",
      historySampleDays: 28,
      countAgeHours: 4,
      isTemporallyAuthoritative: true
    }),
    null
  );
});

test("forecast confidence rises with restaurant history and a fresh verified count", () => {
  assert.equal(FORECAST_CONFIDENCE_CEILING, 0.92);
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: "none",
      historySampleDays: 0,
      countAgeHours: null,
      isTemporallyAuthoritative: false
    }),
    0.25
  );
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: 28,
      countAgeHours: 4,
      isTemporallyAuthoritative: true
    }),
    FORECAST_CONFIDENCE_CEILING
  );
});

test("forecast confidence treats demo and current-day history as weaker than restaurant memory", () => {
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: "demo_fallback",
      historySampleDays: 0,
      countAgeHours: 4,
      isTemporallyAuthoritative: true
    }),
    0.67
  );
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: "current_day",
      historySampleDays: 0,
      countAgeHours: 4,
      isTemporallyAuthoritative: true
    }),
    0.65
  );
});

test("forecast confidence caps below certainty and rounds to hundredths", () => {
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: 100,
      countAgeHours: 1,
      isTemporallyAuthoritative: true
    }),
    FORECAST_CONFIDENCE_CEILING
  );
  assert.equal(
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: "restaurant_history",
      historySampleDays: 7,
      countAgeHours: 48,
      isTemporallyAuthoritative: false
    }),
    0.61
  );
});

test("buildInventoryPrediction exposes forecast confidence from history and count evidence", () => {
  const restaurantId = "forecast_confidence_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "forecast_confidence_chicken",
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
    id: `forecast_confidence_history_${index}`,
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
        id: "forecast_confidence_mapping",
        restaurant_id: restaurantId,
        menu_item_name: "Chicken Bowl",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.25,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.equal(prediction.historySource, "restaurant_history");
  assert.ok((prediction.historySampleDays ?? 0) >= 7);
  assert.equal(
    prediction.forecastConfidence,
    computeForecastConfidence({
      contaminatedProjection: false,
      historySource: prediction.historySource,
      historySampleDays: prediction.historySampleDays,
      countAgeHours: prediction.countAgeHours,
      isTemporallyAuthoritative: prediction.isTemporallyAuthoritative
    })
  );
  assert.ok(prediction.forecastConfidence !== null);
  assert.ok(prediction.forecastConfidence! >= 0.25);
  assert.ok(prediction.forecastConfidence! <= FORECAST_CONFIDENCE_CEILING);
});
