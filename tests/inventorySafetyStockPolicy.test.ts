import assert from "node:assert/strict";
import test from "node:test";

import {
  effectiveReorderThreshold,
  normalizeSafetyStock,
  projectedAtOrBelowSafetyStock
} from "../services/domain/inventorySafetyStockPolicy";
import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { getInventoryStatusForQuantity } from "../utils/inventory";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const supplierId = "bbbbbbbb-0001-4001-8001-bbbbbbbbbbbb";
const itemId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";

function policyItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: itemId,
    restaurant_id: restaurantId,
    item_name: "Chicken breast",
    category: "Protein",
    unit: "lbs",
    current_quantity: 28,
    par_level: 60,
    reorder_threshold: 20,
    safety_stock: 0,
    estimated_unit_cost: 3.7,
    supplier_id: supplierId,
    supplier_name: "Fresh Poultry Supply",
    last_updated: "2026-11-05T12:00:00.000Z",
    ...overrides
  };
}

test("safety stock normalizer clamps and coerces safely", () => {
  assert.equal(normalizeSafetyStock(12.4), 12.4);
  assert.equal(normalizeSafetyStock(2_000_000), 1_000_000);
  assert.equal(normalizeSafetyStock(-1), 0);
  assert.equal(normalizeSafetyStock("nope"), 0);
});

test("effective reorder threshold prefers the binding safety stock", () => {
  assert.equal(effectiveReorderThreshold(20, 0), 20);
  assert.equal(effectiveReorderThreshold(20, 30), 30);
  assert.equal(effectiveReorderThreshold(40, 30), 40);
  assert.equal(projectedAtOrBelowSafetyStock(25, 30, 20), true);
  assert.equal(projectedAtOrBelowSafetyStock(25, 30, 40), false);
  assert.equal(projectedAtOrBelowSafetyStock(0, 30, 20), false);
  assert.equal(projectedAtOrBelowSafetyStock(25, 0, 20), false);
});

test("inventory status uses the effective reorder threshold", () => {
  const item = policyItem({ reorder_threshold: 20, safety_stock: 30 });
  assert.equal(getInventoryStatusForQuantity(item, 28), "Low");
  assert.equal(getInventoryStatusForQuantity(item, 31), "Watch");
  assert.equal(getInventoryStatusForQuantity(policyItem({ safety_stock: 0 }), 28), "Watch");
});

test("inventory prediction surfaces safety-stock risk without inventing a larger order", () => {
  const item = policyItem({
    current_quantity: 28,
    reorder_threshold: 20,
    par_level: 60,
    safety_stock: 30
  });
  const mappings: MenuItemIngredient[] = [
    {
      id: "map-1",
      restaurant_id: restaurantId,
      menu_item_id: null,
      menu_item_name: "Chicken bowl",
      inventory_item_id: itemId,
      quantity_used_per_sale: 0.4,
      unit: "lbs"
    }
  ];
  // 28 on hand − 4 lbs today's mapped usage = 24 projected, above reorder 20 but
  // at/below safety stock 30. Suggested order still restores to par (36).
  const sales: PosSale[] = [
    {
      id: "sale-1",
      restaurant_id: restaurantId,
      sale_date: "2026-11-05",
      item_name: "Chicken bowl",
      category: "Entrees",
      quantity_sold: 10,
      gross_sales: 140,
      net_sales: 140,
      source_pos: "Manual CSV Upload",
      created_at: "2026-11-05T12:00:00.000Z"
    }
  ];

  const prediction = buildInventoryPrediction(item, sales, mappings, "2026-11-05");
  assert.equal(prediction.projectedQuantity, 24);
  assert.equal(prediction.projectedStatus, "Low");
  assert.equal(prediction.coverageLabel, "At or below safety stock");
  assert.equal(prediction.suggestedOrderQuantity, 36);
  assert.match(prediction.suggestedAction, /Order 36 lbs/i);
  assert.match(prediction.whyItMatters, /safety stock/i);
});

test("operational signals recommend restore-to-par when safety stock binds", () => {
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [
      policyItem({
        current_quantity: 28,
        reorder_threshold: 20,
        par_level: 60,
        safety_stock: 30
      })
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: []
  });

  assert.equal(signals.recommendations.length, 1);
  assert.equal(signals.recommendations[0]?.recommended_quantity, 32);
  assert.match(signals.recommendations[0]?.reason ?? "", /30 lbs safety stock/i);
  const insight = signals.insights.find((row) => row.id === `insight_low_${itemId}`);
  assert.ok(insight);
  assert.match(insight?.title ?? "", /safety stock/i);
  assert.match(insight?.why_it_matters ?? "", /safety stock buffer/i);
});

test("zero safety stock keeps reorder-threshold-only triggers", () => {
  const signals = calculateOperationalSignals({
    restaurantId,
    operatingDate: "2026-11-05",
    inventoryItems: [
      policyItem({
        current_quantity: 28,
        reorder_threshold: 20,
        par_level: 60,
        safety_stock: 0
      })
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: []
  });

  assert.equal(signals.recommendations.length, 0);
  assert.equal(
    signals.insights.some((row) => row.id === `insight_low_${itemId}`),
    false
  );
});
