import assert from "node:assert/strict";
import test from "node:test";

import {
  checkDecreasingInventoryFitsOnHand,
  decreasingInventoryExceedsOnHand
} from "../services/domain/inventoryOnHandGuard";

test("accepts waste or usage that leaves non-negative native on-hand", () => {
  const result = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: 2,
    canonicalQuantityPerUnit: 1000,
    decreaseCanonicalQuantity: 1500
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.projectedNativeQuantity, 0.5);
    assert.equal(result.availableCanonicalQuantity, 2000);
  }
  assert.equal(
    decreasingInventoryExceedsOnHand({
      currentNativeQuantity: 2,
      canonicalQuantityPerUnit: 1000,
      decreaseCanonicalQuantity: 1500
    }),
    false
  );
});

test("rejects a decrease that would drive projected on-hand below zero", () => {
  const result = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: 1,
    canonicalQuantityPerUnit: 453.59237,
    decreaseCanonicalQuantity: 500
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "insufficient_on_hand");
    assert.ok((result.availableCanonicalQuantity ?? 0) > 0);
    assert.ok((result.availableCanonicalQuantity ?? 0) < 500);
  }
  assert.equal(
    decreasingInventoryExceedsOnHand({
      currentNativeQuantity: 1,
      canonicalQuantityPerUnit: 453.59237,
      decreaseCanonicalQuantity: 500
    }),
    true
  );
});

test("fails closed on unverified conversion or non-finite inputs", () => {
  const invalidConversion = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: 2,
    canonicalQuantityPerUnit: 0,
    decreaseCanonicalQuantity: 1
  });
  assert.equal(invalidConversion.ok, false);

  const invalidCurrent = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: Number.NaN,
    canonicalQuantityPerUnit: 1000,
    decreaseCanonicalQuantity: 1
  });
  assert.equal(invalidCurrent.ok, false);
  if (!invalidCurrent.ok) assert.equal(invalidCurrent.reason, "invalid_quantity");

  const invalidDecrease = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: 2,
    canonicalQuantityPerUnit: 1000,
    decreaseCanonicalQuantity: -1
  });
  assert.equal(invalidDecrease.ok, false);
  if (!invalidDecrease.ok) assert.equal(invalidDecrease.reason, "invalid_quantity");
});

test("exact on-hand exhaustion remains accepted", () => {
  const result = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: 2.2,
    canonicalQuantityPerUnit: 453.59237,
    decreaseCanonicalQuantity: 2.2 * 453.59237
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(Math.abs(result.projectedNativeQuantity) < 1e-9);
  }
});
