import assert from "node:assert/strict";
import test from "node:test";

import {
  coverageExceedsShelfLife,
  normalizeShelfLifeDays
} from "../services/domain/inventoryShelfLifePolicy";
import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const supplierId = "bbbbbbbb-0001-4001-8001-bbbbbbbbbbbb";
const itemId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";

function policyItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: itemId,
    restaurant_id: restaurantId,
    item_name: "Lettuce",
    category: "Produce",
    unit: "heads",
    current_quantity: 40,
    par_level: 20,
    reorder_threshold: 8,
    shelf_life_days: 0,
    estimated_unit_cost: 1.4,
    supplier_id: supplierId,
    supplier_name: "Local Produce Co.",
    last_updated: "2026-11-05T12:00:00.000Z",
    ...overrides
  };
}

test("shelf life normalizer clamps and coerces safely", () => {
  assert.equal(normalizeShelfLifeDays(4.9), 4);
  assert.equal(normalizeShelfLifeDays(4000), 3650);
  assert.equal(normalizeShelfLifeDays(-1), 0);
  assert.equal(normalizeShelfLifeDays("nope"), 0);
});

test("shelf life coverage gate is inactive at zero and fails closed on non-finite coverage", () => {
  assert.equal(coverageExceedsShelfLife(6, 0), false);
  assert.equal(coverageExceedsShelfLife(6, 5), true);
  assert.equal(coverageExceedsShelfLife(5, 5), false);
  assert.equal(coverageExceedsShelfLife(4.9, 5), false);
  assert.equal(coverageExceedsShelfLife(null, 5), false);
  assert.equal(coverageExceedsShelfLife(Number.NaN, 5), false);
});

test("inventory prediction surfaces shelf-life waste risk without inventing an order", () => {
  const item = policyItem({
    current_quantity: 40,
    reorder_threshold: 5,
    par_level: 20,
    shelf_life_days: 3
  });
  const mappings: MenuItemIngredient[] = [
    {
      id: "map-1",
      restaurant_id: restaurantId,
      menu_item_id: null,
      menu_item_name: "Salad",
      inventory_item_id: itemId,
      quantity_used_per_sale: 0.5,
      unit: "heads"
    }
  ];
  // 40 on hand − 5 heads today's mapped usage = 35 projected / 5 = 7 days coverage,
  // above the 3-day shelf life and outside acute stockout bands.
  const sales: PosSale[] = [
    {
      id: "sale-1",
      restaurant_id: restaurantId,
      sale_date: "2026-11-05",
      item_name: "Salad",
      category: "Entrees",
      quantity_sold: 10,
      gross_sales: 100,
      net_sales: 100,
      source_pos: "Manual CSV Upload",
      created_at: "2026-11-05T12:00:00.000Z"
    }
  ];

  const prediction = buildInventoryPrediction(item, sales, mappings, "2026-11-05");
  assert.ok((prediction.daysCoverage ?? 0) > 3);
  assert.equal(prediction.coverageLabel, "May spoil before use");
  assert.equal(prediction.suggestedAction, "Prioritize use or delay next order");
  assert.match(prediction.whyItMatters, /3-day shelf life/i);
  assert.equal(prediction.projectedStatus, "Good");
  assert.match(prediction.recommendationCopy, /does not recommend an order/i);
});

function historicalSaladSales(): PosSale[] {
  return Array.from({ length: 10 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      id: `sale-hist-${day}`,
      restaurant_id: restaurantId,
      sale_date: `2026-10-${day}`,
      item_name: "Salad",
      category: "Entrees",
      quantity_sold: 10,
      gross_sales: 100,
      net_sales: 100,
      source_pos: "Manual CSV Upload",
      created_at: `2026-10-${day}T12:00:00.000Z`
    };
  });
}

const saladMapping: MenuItemIngredient = {
  id: "map-1",
  restaurant_id: restaurantId,
  menu_item_id: null,
  menu_item_name: "Salad",
  inventory_item_id: itemId,
  quantity_used_per_sale: 0.5,
  unit: "heads"
};

test("operational signals prefer shelf-life overstock copy when configured", () => {
  // ~5 heads/day historical usage with 40 on hand ≈ 8 days coverage above a 2-day shelf life.
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [
      policyItem({
        current_quantity: 40,
        reorder_threshold: 5,
        par_level: 20,
        shelf_life_days: 2
      })
    ],
    sales: historicalSaladSales(),
    menuItemIngredients: [saladMapping],
    recommendationHistory: []
  });

  const overstock = signals.insights.find((insight) => insight.id === `insight_overstock_${itemId}`);
  assert.ok(overstock);
  assert.equal(overstock?.insight_type, "waste");
  assert.match(overstock?.description ?? "", /2-day shelf life/i);
  assert.equal(signals.recommendations.length, 0);
});

test("zero shelf life keeps the generic three-day overstock heuristic", () => {
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [
      policyItem({
        current_quantity: 40,
        reorder_threshold: 5,
        par_level: 20,
        shelf_life_days: 0
      })
    ],
    sales: historicalSaladSales(),
    menuItemIngredients: [saladMapping],
    recommendationHistory: []
  });

  const overstock = signals.insights.find((insight) => insight.id === `insight_overstock_${itemId}`);
  assert.ok(overstock);
  assert.match(overstock?.description ?? "", /three service days/i);
  assert.doesNotMatch(overstock?.description ?? "", /shelf life/i);
});
