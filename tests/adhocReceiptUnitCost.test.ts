import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdhocReceiptMetadata,
  normalizeAdhocReceiptUnitCost,
  proposeAdhocReceiptUnitCostApply,
  unitCostFromReceiptMetadata
} from "../services/domain/adhocReceiptUnitCost";

test("normalizes bounded ad-hoc receipt unit costs and rejects invalid values", () => {
  assert.equal(normalizeAdhocReceiptUnitCost("2.5"), 2.5);
  assert.equal(normalizeAdhocReceiptUnitCost(1.23456), 1.2346);
  assert.equal(normalizeAdhocReceiptUnitCost(""), null);
  assert.equal(normalizeAdhocReceiptUnitCost(null), null);
  assert.equal(normalizeAdhocReceiptUnitCost(-1), null);
  assert.equal(normalizeAdhocReceiptUnitCost(1_000_001), null);
});

test("receipt metadata keeps optional note and unit cost without inventing either", () => {
  assert.deepEqual(buildAdhocReceiptMetadata({}), {});
  assert.deepEqual(buildAdhocReceiptMetadata({ note: " Cold ", unitCost: 3.25 }), {
    note: "Cold",
    unitCost: 3.25
  });
  assert.equal(unitCostFromReceiptMetadata({ unitCost: 4 }), 4);
  assert.equal(unitCostFromReceiptMetadata({ note: "only" }), null);
  assert.equal(unitCostFromReceiptMetadata({ unitCost: "nope" }), null);
});

test("propose apply fails closed across tenants and identical costs", () => {
  const item = {
    id: "item-1",
    restaurant_id: "rest-a",
    estimated_unit_cost: 2.5
  };
  assert.deepEqual(
    proposeAdhocReceiptUnitCostApply({
      restaurantId: "rest-a",
      inventoryItem: item,
      unitCost: 3
    }),
    { ok: true, unitCost: 3, previousUnitCost: 2.5 }
  );
  assert.equal(
    proposeAdhocReceiptUnitCostApply({
      restaurantId: "rest-b",
      inventoryItem: item,
      unitCost: 3
    }).ok,
    false
  );
  assert.equal(
    proposeAdhocReceiptUnitCostApply({
      restaurantId: "rest-a",
      inventoryItem: item,
      unitCost: 2.5
    }).ok,
    false
  );
  assert.equal(
    proposeAdhocReceiptUnitCostApply({
      restaurantId: "rest-a",
      inventoryItem: item,
      unitCost: -1
    }).ok,
    false
  );
});
