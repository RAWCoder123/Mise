import assert from "node:assert/strict";
import test from "node:test";

import { buildInventoryPrediction } from "../services/domain/miseDomain";
import {
  DEMAND_INTENSITY_FALLING_THRESHOLD,
  DEMAND_INTENSITY_RISING_THRESHOLD,
  computeDemandIntensityRatio
} from "../services/domain/demandIntensityRatio";
import { contaminatedInventoryCountEvidence } from "../services/domain/inventoryCountAuthority";
import { addDays, toDateKey } from "../utils/format";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";

test("demand intensity ratio compares today mapped usage to baseline", () => {
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: 12,
      baselineUsage: 10
    }),
    1.2
  );
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: 8,
      baselineUsage: 10
    }),
    0.8
  );
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: 0,
      baselineUsage: 10
    }),
    0
  );
});

test("demand intensity ratio stays null without a positive baseline or when contaminated", () => {
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: 12,
      baselineUsage: 0
    }),
    null
  );
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: true,
      todayMappedUsage: 12,
      baselineUsage: 10
    }),
    null
  );
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: Number.NaN,
      baselineUsage: 10
    }),
    null
  );
  assert.equal(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: -1,
      baselineUsage: 10
    }),
    null
  );
});

test("demand intensity thresholds stay aligned with rising and falling trend cutoffs", () => {
  assert.equal(DEMAND_INTENSITY_RISING_THRESHOLD, 1.15);
  assert.equal(DEMAND_INTENSITY_FALLING_THRESHOLD, 0.8);
  assert.ok(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: 12,
      baselineUsage: 10
    })! > DEMAND_INTENSITY_RISING_THRESHOLD
  );
  assert.ok(
    computeDemandIntensityRatio({
      contaminatedProjection: false,
      todayMappedUsage: 7,
      baselineUsage: 10
    })! < DEMAND_INTENSITY_FALLING_THRESHOLD
  );
});

test("buildInventoryPrediction exposes demand intensity when history and today sales exist", () => {
  const restaurantId = "demand_intensity_ratio_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "demand_intensity_ratio_produce",
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
    id: `demand_intensity_ratio_history_${index}`,
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
        id: "demand_intensity_ratio_today",
        restaurant_id: restaurantId,
        sale_date: operatingDate,
        item_name: "Tomato Salad",
        category: "Appetizer",
        quantity_sold: 15,
        gross_sales: 120,
        net_sales: 110,
        source_pos: "Test POS",
        created_at: new Date().toISOString()
      }
    ],
    [
      {
        id: "demand_intensity_ratio_recipe",
        restaurant_id: restaurantId,
        menu_item_name: "Tomato Salad",
        inventory_item_id: item.id,
        quantity_used_per_sale: 0.5,
        unit: "lb"
      }
    ],
    operatingDate
  );

  assert.equal(prediction.demandTrend, "rising");
  assert.ok(prediction.demandIntensityRatio !== null);
  assert.ok(prediction.demandIntensityRatio! > DEMAND_INTENSITY_RISING_THRESHOLD);
});

test("buildInventoryPrediction keeps demand intensity null for contaminated projections", () => {
  const restaurantId = "demand_intensity_contaminated_restaurant";
  const operatingDate = toDateKey(new Date());
  const item = {
    id: "demand_intensity_contaminated_item",
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
  assert.equal(prediction.demandIntensityRatio, null);
});
