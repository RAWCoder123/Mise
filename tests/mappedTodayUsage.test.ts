import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventoryCountEvidence,
  missingInventoryCountEvidence,
  type VerifiedCountCandidate
} from "../services/domain/inventoryCountAuthority";
import { buildInventoryPrediction } from "../services/domain/miseDomain";
import { computeMappedTodayUsage } from "../services/domain/mappedTodayUsage";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const TEST_SUPPLIER_ID = "10000000-0000-4000-8000-000000000001";
const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "mapped-today-usage-chicken";
const operatingDate = "2026-08-17";
const evaluatedAt = "2026-08-17T23:00:00.000Z";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: itemId,
    restaurant_id: restaurantId,
    item_name: "Chicken Thigh",
    category: "Proteins",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 4,
    supplier_id: TEST_SUPPLIER_ID,
    supplier_name: "Protein Co",
    last_updated: "2026-08-17T23:59:00.000Z",
    ...overrides
  };
}

function sale(overrides: Partial<PosSale> = {}): PosSale {
  return {
    id: "mapped-today-usage-sale",
    restaurant_id: restaurantId,
    sale_date: operatingDate,
    item_name: "Chicken bowl",
    category: "Entree",
    quantity_sold: 8,
    gross_sales: 96,
    net_sales: 90,
    source_pos: "Test POS",
    created_at: "2026-08-17T12:00:00.000Z",
    ...overrides
  };
}

function mapping(overrides: Partial<MenuItemIngredient> = {}): MenuItemIngredient {
  return {
    id: "mapped-today-usage-recipe",
    restaurant_id: restaurantId,
    menu_item_name: "Chicken bowl",
    inventory_item_id: itemId,
    quantity_used_per_sale: 0.5,
    unit: "lb",
    ...overrides
  };
}

function countEvent(effectiveAt: string, quantity: number): VerifiedCountCandidate {
  return {
    id: `count-${effectiveAt}`,
    restaurantId,
    inventoryItemId: itemId,
    eventType: "count",
    effectiveAt,
    sequence: 1,
    quantity
  };
}

function evidenceFor(events: readonly VerifiedCountCandidate[]) {
  const scopedItem = item();
  const map = buildInventoryCountEvidence({
    restaurantId,
    items: [scopedItem],
    ledgerEvents: events,
    generatedAt: evaluatedAt
  });
  return map.get(scopedItem.id) ?? missingInventoryCountEvidence(restaurantId, scopedItem.id);
}

test("mapped today usage rounds a positive observed rate to hundredths", () => {
  assert.equal(computeMappedTodayUsage({ mappedTodayUsage: 10 }), 10);
  assert.equal(computeMappedTodayUsage({ mappedTodayUsage: 2.567 }), 2.57);
});

test("mapped today usage collapses non-positive or non-finite input to zero", () => {
  assert.equal(computeMappedTodayUsage({ mappedTodayUsage: 0 }), 0);
  assert.equal(computeMappedTodayUsage({ mappedTodayUsage: -1 }), 0);
  assert.equal(computeMappedTodayUsage({ mappedTodayUsage: Number.NaN }), 0);
  assert.equal(computeMappedTodayUsage({ mappedTodayUsage: Number.POSITIVE_INFINITY }), 0);
});

test("buildInventoryPrediction keeps mapped today usage when a midday count absorbs POS", () => {
  const countedItem = item({ current_quantity: 10 });
  const prediction = buildInventoryPrediction(
    countedItem,
    [sale()],
    [mapping()],
    operatingDate,
    undefined,
    undefined,
    evidenceFor([countEvent("2026-08-17T13:00:00.000Z", 10)])
  );

  assert.equal(prediction.todayDepletion, 0);
  assert.equal(prediction.unattributedTodayDepletion, 4);
  assert.equal(prediction.mappedTodayUsage, 4);
  assert.equal(
    prediction.mappedTodayUsage,
    prediction.todayDepletion + prediction.unattributedTodayDepletion
  );
});

test("buildInventoryPrediction aligns mapped today usage with subtractable depletion after prior-day count", () => {
  const countedItem = item({ current_quantity: 10 });
  const prediction = buildInventoryPrediction(
    countedItem,
    [sale()],
    [mapping()],
    operatingDate,
    undefined,
    undefined,
    evidenceFor([countEvent("2026-08-16T08:00:00.000Z", 10)])
  );

  assert.equal(prediction.mappedTodayUsage, 4);
  assert.equal(prediction.todayDepletion, 4);
  assert.equal(prediction.unattributedTodayDepletion, 0);
});

test("buildInventoryPrediction reports zero mapped today usage while still learning", () => {
  const prediction = buildInventoryPrediction(item(), [], [], operatingDate);

  assert.equal(prediction.historySource, "none");
  assert.equal(prediction.mappedTodayUsage, 0);
  assert.equal(prediction.todayDepletion, 0);
});
