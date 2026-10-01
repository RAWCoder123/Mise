import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustmentDirectionFromSignedQuantity,
  isInventoryAdjustmentReasonCode,
  signedAdjustmentQuantity
} from "../services/domain/inventoryAdjustment";
import { requireInventoryAdjustment, requireInventoryOperation } from "../services/miseValidation";

const base = {
  restaurantId: "restaurant-a",
  inventoryItemId: "chicken",
  canonicalUnit: "g" as const,
  effectiveAt: "2026-09-02T10:00:00.000Z"
};

test("signed adjustment helpers map direction and magnitude", () => {
  assert.equal(signedAdjustmentQuantity(12, "increase"), 12);
  assert.equal(signedAdjustmentQuantity(12, "decrease"), -12);
  assert.equal(signedAdjustmentQuantity(0, "increase"), null);
  assert.equal(signedAdjustmentQuantity(Number.NaN, "decrease"), null);
  assert.equal(adjustmentDirectionFromSignedQuantity(4), "increase");
  assert.equal(adjustmentDirectionFromSignedQuantity(-4), "decrease");
  assert.equal(adjustmentDirectionFromSignedQuantity(0), null);
  assert.equal(isInventoryAdjustmentReasonCode("found"), true);
  assert.equal(isInventoryAdjustmentReasonCode("bogus"), false);
});

test("manager adjustments accept signed deltas with a required note", () => {
  assert.deepEqual(
    requireInventoryAdjustment({
      ...base,
      quantity: "-250",
      note: "  Walk-in variance after investigation  ",
      reasonCode: "lost"
    }),
    {
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "adjustment",
      quantity: -250,
      canonicalUnit: "g",
      effectiveAt: "2026-09-02T10:00:00.000Z",
      source: "operator_adjustment",
      sourceReference: null,
      reasonCode: "lost",
      supersedesEventId: null,
      metadata: { note: "Walk-in variance after investigation" }
    }
  );
});

test("manager adjustments reject zero, missing notes, and invalid reasons", () => {
  assert.throws(
    () => requireInventoryAdjustment({ ...base, quantity: 0, note: "Found case" }),
    /non-zero adjustment quantity/
  );
  assert.throws(
    () => requireInventoryAdjustment({ ...base, quantity: 10, note: "   " }),
    /valid note/
  );
  assert.throws(
    () =>
      requireInventoryAdjustment({
        ...base,
        quantity: 10,
        note: "Found case",
        reasonCode: "invented"
      }),
    /valid adjustment reason/
  );
});

test("ordinary inventory operations still reject adjustments and corrections", () => {
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "adjustment", quantity: 1 }),
    /supported inventory operation/
  );
  assert.throws(
    () => requireInventoryOperation({ ...base, eventType: "correction", quantity: 1 }),
    /supported inventory operation/
  );
});
