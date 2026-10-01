import assert from "node:assert/strict";
import test from "node:test";

import {
  isWasteReasonCode,
  requireWasteReasonCode,
  WASTE_REASON_CODES,
  wasteReasonMessageKey
} from "../services/domain/wasteReasonCodes";
import { requireInventoryOperation } from "../services/miseValidation";

test("waste reason allowlist covers the operator categories", () => {
  assert.deepEqual([...WASTE_REASON_CODES], [
    "spoilage",
    "prep_trim",
    "overproduction",
    "dropped_broken",
    "expired",
    "other"
  ]);
  assert.equal(isWasteReasonCode("spoilage"), true);
  assert.equal(isWasteReasonCode("delivery"), false);
  assert.equal(wasteReasonMessageKey("prep_trim"), "waste.reason.prep_trim");
  assert.equal(wasteReasonMessageKey(null), "waste.reason.unspecified");
});

test("waste reason codes normalize spacing and reject unknown values", () => {
  assert.equal(requireWasteReasonCode(" Spoilage "), "spoilage");
  assert.equal(requireWasteReasonCode("prep-trim"), "prep_trim");
  assert.equal(requireWasteReasonCode(""), null);
  assert.equal(requireWasteReasonCode(undefined), null);
  assert.throws(() => requireWasteReasonCode("delivery"), /supported waste reason/);
  assert.throws(() => requireWasteReasonCode(12), /Choose a waste reason/);
});

test("waste inventory operations accept allowlisted reason codes only", () => {
  const base = {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "waste",
    quantity: 250,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z"
  } as const;

  assert.equal(
    requireInventoryOperation({ ...base, reasonCode: " Spoilage " }).reasonCode,
    "spoilage"
  );
  assert.equal(requireInventoryOperation(base).reasonCode, null);
  assert.throws(
    () => requireInventoryOperation({ ...base, reasonCode: "delivery" }),
    /supported waste reason/
  );
  assert.equal(
    requireInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "receipt",
      quantity: 250,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      reasonCode: "delivery"
    }).reasonCode,
    "delivery"
  );
});
