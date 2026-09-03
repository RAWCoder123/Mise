import assert from "node:assert/strict";
import test from "node:test";

import {
  isInventoryUsageReasonCode,
  INVENTORY_USAGE_REASON_CODES
} from "../services/domain/inventoryUsage";
import { requireInventoryOperation, requireInventoryUsage } from "../services/miseValidation";

const base = {
  restaurantId: "restaurant-a",
  inventoryItemId: "chicken",
  canonicalUnit: "g" as const,
  effectiveAt: "2026-09-03T10:00:00.000Z"
};

test("usage reason codes are bounded and recognizable", () => {
  assert.deepEqual([...INVENTORY_USAGE_REASON_CODES], [
    "prep",
    "staff_meal",
    "tasting",
    "training",
    "other"
  ]);
  assert.equal(isInventoryUsageReasonCode("prep"), true);
  assert.equal(isInventoryUsageReasonCode("staff_meal"), true);
  assert.equal(isInventoryUsageReasonCode("bogus"), false);
});

test("manager usage accepts positive quantities with a required note", () => {
  assert.deepEqual(
    requireInventoryUsage({
      ...base,
      quantity: "250",
      note: "  Prep draw-down for lunch  ",
      reasonCode: "prep"
    }),
    {
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "usage",
      quantity: 250,
      canonicalUnit: "g",
      effectiveAt: "2026-09-03T10:00:00.000Z",
      source: "operator_usage",
      sourceReference: null,
      reasonCode: "prep",
      supersedesEventId: null,
      metadata: { note: "Prep draw-down for lunch" }
    }
  );
});

test("manager usage rejects zero, missing notes, and invalid reasons", () => {
  assert.throws(
    () => requireInventoryUsage({ ...base, quantity: 0, note: "Prep" }),
    /usage quantity greater than zero/
  );
  assert.throws(
    () => requireInventoryUsage({ ...base, quantity: 10, note: "   " }),
    /valid note/
  );
  assert.throws(
    () =>
      requireInventoryUsage({
        ...base,
        quantity: 10,
        note: "Prep",
        reasonCode: "invented"
      }),
    /valid usage reason/
  );
  assert.throws(
    () => requireInventoryUsage({ ...base, quantity: -5, note: "Prep" }),
    /valid inventory quantity/
  );
});

test("ordinary inventory operations still reject usage and corrections", () => {
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "usage", quantity: 1 }),
    /supported inventory operation/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "correction", quantity: 1 }),
    /supported inventory operation/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "adjustment", quantity: 1 }),
    /supported inventory operation/
  );
});
