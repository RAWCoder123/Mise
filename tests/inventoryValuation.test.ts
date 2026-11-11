import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildInventoryOnHandValuation } from "../services/domain/inventoryValuation";
import {
  presentInventoryHealthBodyWithValuation,
  presentInventoryOnHandValuationLine
} from "../services/presentation/inventoryValuationPresentation";
import type { InventoryItem } from "../types/mise";

const restaurantId = "restaurant-valuation";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: overrides.id ?? "item-1",
    restaurant_id: restaurantId,
    item_name: overrides.item_name ?? "Tomato",
    category: "Produce",
    unit: "lb",
    current_quantity: overrides.current_quantity ?? 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: overrides.estimated_unit_cost ?? 2.5,
    supplier_id: "supplier-1",
    supplier_name: "Fresh Co",
    last_updated: "2026-11-11T00:00:00.000Z",
    ...overrides
  };
}

test("buildInventoryOnHandValuation sums priced on-hand and keeps incomplete costs visible", () => {
  const valuation = buildInventoryOnHandValuation({
    restaurantId,
    items: [
      item({ id: "a", current_quantity: 4, estimated_unit_cost: 2.5 }),
      item({ id: "b", current_quantity: 3, estimated_unit_cost: 0 }),
      item({ id: "c", current_quantity: 2, estimated_unit_cost: 1.25 })
    ]
  });

  assert.equal(valuation.itemCount, 3);
  assert.equal(valuation.pricedItemCount, 2);
  assert.equal(valuation.unpricedItemCount, 1);
  assert.equal(valuation.valuedOnHand, 12.5);
  assert.equal(valuation.costComplete, false);
});

test("buildInventoryOnHandValuation returns null total when no priced items exist", () => {
  const valuation = buildInventoryOnHandValuation({
    restaurantId,
    items: [item({ estimated_unit_cost: 0 }), item({ id: "x", estimated_unit_cost: -1 })]
  });

  assert.equal(valuation.valuedOnHand, null);
  assert.equal(valuation.pricedItemCount, 0);
  assert.equal(valuation.unpricedItemCount, 2);
  assert.equal(valuation.costComplete, false);
});

test("buildInventoryOnHandValuation marks complete tenants and rounds currency", () => {
  const valuation = buildInventoryOnHandValuation({
    restaurantId,
    items: [
      item({ current_quantity: 1.333, estimated_unit_cost: 1.1 }),
      item({ id: "b", current_quantity: 2, estimated_unit_cost: 0.333 })
    ]
  });

  assert.equal(valuation.costComplete, true);
  assert.equal(valuation.unpricedItemCount, 0);
  assert.equal(valuation.valuedOnHand, 2.13);
});

test("buildInventoryOnHandValuation rejects blank restaurant and cross-tenant rows", () => {
  assert.throws(
    () => buildInventoryOnHandValuation({ restaurantId: "  ", items: [] }),
    /requires a restaurant/i
  );
  assert.throws(
    () =>
      buildInventoryOnHandValuation({
        restaurantId,
        items: [item({ restaurant_id: "other" })]
      }),
    /cross-restaurant/i
  );
});

test("presentation keeps missing costs explicit and appends to risk copy", () => {
  const t = (key: string, values: Record<string, string | number> = {}) => {
    if (key === "inventory.health.valuation.missingCosts") return "Add unit costs to see on-hand value.";
    if (key === "inventory.health.valuation.complete") return `On-hand value ${values.amount}.`;
    if (key === "inventory.health.valuation.incomplete.one") {
      return `On-hand value ${values.amount}. ${values.count} item still needs a unit cost.`;
    }
    if (key === "inventory.health.valuation.incomplete.other") {
      return `On-hand value ${values.amount}. ${values.count} items still need a unit cost.`;
    }
    return key;
  };

  assert.equal(
    presentInventoryOnHandValuationLine({
      valuation: {
        restaurantId,
        itemCount: 2,
        pricedItemCount: 0,
        unpricedItemCount: 2,
        valuedOnHand: null,
        costComplete: false
      },
      formatCurrency: (value) => `$${value}`,
      formatNumber: (value) => String(value),
      t
    }),
    "Add unit costs to see on-hand value."
  );

  assert.equal(
    presentInventoryOnHandValuationLine({
      valuation: {
        restaurantId,
        itemCount: 2,
        pricedItemCount: 1,
        unpricedItemCount: 1,
        valuedOnHand: 12.5,
        costComplete: false
      },
      formatCurrency: (value) => `$${value.toFixed(2)}`,
      formatNumber: (value) => String(value),
      t
    }),
    "On-hand value $12.50. 1 item still needs a unit cost."
  );

  assert.equal(
    presentInventoryHealthBodyWithValuation({
      riskBody: "Mise found 2 items near reorder risk across the kitchen.",
      valuationLine: "On-hand value $12.50."
    }),
    "Mise found 2 items near reorder risk across the kitchen. On-hand value $12.50."
  );
});

test("inventory hub wires valuation into the health summary body", () => {
  const source = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  assert.match(source, /buildInventoryOnHandValuation/);
  assert.match(source, /presentInventoryOnHandValuationLine/);
  assert.match(source, /presentInventoryHealthBodyWithValuation/);
  assert.match(source, /formatCurrency/);
  assert.match(source, /valuationLine/);
});

test("catalog localizes inventory valuation keys in EN, ES, and zh-Hans", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "inventory.health.valuation.complete",
    "inventory.health.valuation.incomplete.one",
    "inventory.health.valuation.incomplete.other",
    "inventory.health.valuation.missingCosts"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must exist in EN, ES, and zh-Hans`);
  }
});
