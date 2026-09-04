import assert from "node:assert/strict";
import test from "node:test";

import { requireInventoryOperation } from "../services/miseValidation";

test("receiving input becomes bounded canonical ledger evidence", () => {
  assert.deepEqual(
    requireInventoryOperation({
      restaurantId: " restaurant-a ",
      inventoryItemId: " chicken ",
      eventType: "receipt",
      quantity: "1250",
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00-04:00",
      sourceReference: " invoice-42 ",
      reasonCode: " delivery ",
      note: " Chilled on arrival "
    }),
    {
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "receipt",
      quantity: 1250,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T14:00:00.000Z",
      source: "operator_receipt",
      sourceReference: "invoice-42",
      reasonCode: "delivery",
      supersedesEventId: null,
      metadata: { note: "Chilled on arrival" }
    }
  );
});

test("receipts and waste require positive quantities while counts are not operator-queueable", () => {
  const base = {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    canonicalUnit: "g" as const,
    effectiveAt: "2026-07-26T10:00:00.000Z"
  };
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "count", quantity: 0 }),
    /supported inventory operation/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "count", quantity: 12 }),
    /supported inventory operation/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "receipt", quantity: 0 }),
    /greater than zero/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "waste", quantity: 0 }),
    /greater than zero/
  );
});

test("stockouts are explicit zeroes and unsupported event types fail closed", () => {
  const base = {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z"
  };
  assert.equal(
    requireInventoryOperation({ ...base, eventType: "stockout", quantity: 0 }).eventType,
    "stockout"
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "stockout", quantity: 1 }),
    /must be zero/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "correction", quantity: 1 }),
    /supported inventory operation/
  );
});

test("invalid units, times, anomalous quantities, and unbounded evidence are rejected", () => {
  const base = {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z"
  };
  assert.throws(() => requireInventoryOperation({ ...base, canonicalUnit: "lb" }), /grams/);
  assert.throws(() => requireInventoryOperation({ ...base, effectiveAt: "today" }), /valid inventory time/);
  assert.throws(() => requireInventoryOperation({ ...base, quantity: Number.NaN }), /valid inventory quantity/);
  assert.throws(() => requireInventoryOperation({ ...base, quantity: "" }), /valid inventory quantity/);
  assert.throws(() => requireInventoryOperation({ ...base, quantity: null }), /valid inventory quantity/);
  assert.throws(() => requireInventoryOperation({ ...base, quantity: false }), /valid inventory quantity/);
  assert.throws(() => requireInventoryOperation({ ...base, note: "x".repeat(501) }), /shorter note/);
  assert.throws(() => requireInventoryOperation({ ...base, sourceReference: "x".repeat(201) }), /shorter reference/);
});
