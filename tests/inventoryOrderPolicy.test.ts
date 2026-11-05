import assert from "node:assert/strict";
import test from "node:test";

import {
  applyMinimumOrderQuantity,
  coverageWithinLeadTime,
  normalizeLeadTimeDays,
  normalizeMinimumOrderQuantity
} from "../services/domain/inventoryOrderPolicy";
import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const supplierId = "aaaaaaaa-0001-4001-8001-aaaaaaaaaaaa";
const itemId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

function policyItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: itemId,
    restaurant_id: restaurantId,
    item_name: "Chicken breast",
    category: "Protein",
    unit: "lb",
    current_quantity: 18,
    par_level: 40,
    reorder_threshold: 10,
    lead_time_days: 0,
    minimum_order_quantity: 0,
    estimated_unit_cost: 3,
    supplier_id: supplierId,
    supplier_name: "Fresh Poultry",
    last_updated: "2026-11-05T12:00:00.000Z",
    ...overrides
  };
}

test("MOQ raises a positive shortfall and never invents a zero-shortfall order", () => {
  assert.equal(applyMinimumOrderQuantity(12, 20), 20);
  assert.equal(applyMinimumOrderQuantity(25, 20), 25);
  assert.equal(applyMinimumOrderQuantity(0, 20), 0);
  assert.equal(applyMinimumOrderQuantity(-4, 20), 0);
  assert.equal(applyMinimumOrderQuantity(12, 0), 12);
  assert.equal(applyMinimumOrderQuantity(12, -5), 12);
});

test("lead time coverage gate is inactive at zero and fails closed on non-finite coverage", () => {
  assert.equal(coverageWithinLeadTime(1.5, 0), false);
  assert.equal(coverageWithinLeadTime(1.5, 2), true);
  assert.equal(coverageWithinLeadTime(2, 2), true);
  assert.equal(coverageWithinLeadTime(2.1, 2), false);
  assert.equal(coverageWithinLeadTime(null, 3), false);
  assert.equal(coverageWithinLeadTime(Number.NaN, 3), false);
});

test("lead time and MOQ normalizers clamp and coerce safely", () => {
  assert.equal(normalizeLeadTimeDays(2.9), 2);
  assert.equal(normalizeLeadTimeDays(400), 365);
  assert.equal(normalizeLeadTimeDays(-1), 0);
  assert.equal(normalizeLeadTimeDays("nope"), 0);
  assert.equal(normalizeMinimumOrderQuantity(12.5), 12.5);
  assert.equal(normalizeMinimumOrderQuantity(2_000_000), 1_000_000);
  assert.equal(normalizeMinimumOrderQuantity(-3), 0);
});

test("operational signals raise MOQ on low-stock recommendations", () => {
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [
      policyItem({
        current_quantity: 8,
        reorder_threshold: 10,
        par_level: 20,
        minimum_order_quantity: 25
      })
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: []
  });
  assert.equal(signals.recommendations.length, 1);
  assert.equal(signals.recommendations[0]?.recommended_quantity, 25);
});

test("inventory prediction marks lead-time coverage risk and raises MOQ", () => {
  const item = policyItem({
    current_quantity: 24,
    reorder_threshold: 5,
    par_level: 40,
    lead_time_days: 3,
    minimum_order_quantity: 50
  });
  const mappings: MenuItemIngredient[] = [
    {
      id: "map-1",
      restaurant_id: restaurantId,
      menu_item_id: null,
      menu_item_name: "Chicken plate",
      inventory_item_id: itemId,
      quantity_used_per_sale: 1,
      unit: "lb"
    }
  ];
  const sales: PosSale[] = [
    {
      id: "sale-1",
      restaurant_id: restaurantId,
      sale_date: "2026-11-05",
      item_name: "Chicken plate",
      category: "Entrees",
      quantity_sold: 8,
      gross_sales: 80,
      net_sales: 80,
      source_pos: "Manual CSV Upload",
      created_at: "2026-11-05T12:00:00.000Z"
    }
  ];
  const prediction = buildInventoryPrediction(item, sales, mappings, "2026-11-05");
  // 24 on hand − 8 lb today's mapped usage = 16 projected / 8 lb usage = 2 days coverage,
  // inside the 3-day lead time but outside the acute "run out today/tomorrow" bands.
  // Shortfall to par is 24 lb; MOQ raises the suggestion to 50.
  assert.ok((prediction.daysCoverage ?? 99) > 1.5);
  assert.ok((prediction.daysCoverage ?? 99) <= 3);
  assert.equal(prediction.projectedStatus, "Low");
  assert.match(prediction.coverageLabel, /3-day supplier lead time/i);
  assert.equal(prediction.suggestedOrderQuantity, 50);
});

test("operational signals recommend when established demand sits inside lead time", () => {
  const mappings: MenuItemIngredient[] = [
    {
      id: "map-1",
      restaurant_id: restaurantId,
      menu_item_id: null,
      menu_item_name: "Chicken plate",
      inventory_item_id: itemId,
      quantity_used_per_sale: 1,
      unit: "lb"
    }
  ];
  const historicalSales: PosSale[] = Array.from({ length: 10 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return {
      id: `sale-hist-${day}`,
      restaurant_id: restaurantId,
      sale_date: `2026-10-${day}`,
      item_name: "Chicken plate",
      category: "Entrees",
      quantity_sold: 8,
      gross_sales: 80,
      net_sales: 80,
      source_pos: "Manual CSV Upload",
      created_at: `2026-10-${day}T12:00:00.000Z`
    };
  });
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [
      policyItem({
        current_quantity: 16,
        reorder_threshold: 5,
        par_level: 40,
        lead_time_days: 3
      })
    ],
    sales: historicalSales,
    menuItemIngredients: mappings,
    recommendationHistory: []
  });
  // 16 lb / ~8 lb historical daily usage ≈ 2 days coverage inside 3-day lead time.
  assert.equal(signals.recommendations.length, 1);
  assert.match(signals.recommendations[0]?.reason ?? "", /3-day supplier lead time/i);
  assert.match(signals.insights[0]?.title ?? "", /may not cover supplier lead time/i);
});
