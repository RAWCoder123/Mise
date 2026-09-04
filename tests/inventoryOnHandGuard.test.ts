import assert from "node:assert/strict";
import test from "node:test";

import {
  checkDecreasingInventoryFitsOnHand,
  checkIncreasingInventoryFitsOnHand,
  decreasingInventoryExceedsOnHand,
  increasingInventoryExceedsOnHandCeiling,
  onHandLimitRejectionReason
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

test("accepts a receipt that stays at or under the native on-hand ceiling", () => {
  const result = checkIncreasingInventoryFitsOnHand({
    currentNativeQuantity: 999_999,
    canonicalQuantityPerUnit: 1000,
    increaseCanonicalQuantity: 1000
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.projectedNativeQuantity, 1_000_000);
    assert.equal(result.remainingCanonicalCapacity, 1000);
  }
  assert.equal(
    increasingInventoryExceedsOnHandCeiling({
      currentNativeQuantity: 999_999,
      canonicalQuantityPerUnit: 1000,
      increaseCanonicalQuantity: 1000
    }),
    false
  );
});

test("rejects a receipt that would push projected on-hand above the ceiling", () => {
  const result = checkIncreasingInventoryFitsOnHand({
    currentNativeQuantity: 999_999.5,
    canonicalQuantityPerUnit: 1000,
    increaseCanonicalQuantity: 1000
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "exceeds_on_hand_ceiling");
    assert.equal(result.remainingCanonicalCapacity, 500);
  }
  assert.equal(
    increasingInventoryExceedsOnHandCeiling({
      currentNativeQuantity: 999_999.5,
      canonicalQuantityPerUnit: 1000,
      increaseCanonicalQuantity: 1000
    }),
    true
  );
});

test("fails closed on unverified conversion or non-finite inputs for both directions", () => {
  const invalidConversion = checkIncreasingInventoryFitsOnHand({
    currentNativeQuantity: 2,
    canonicalQuantityPerUnit: 0,
    increaseCanonicalQuantity: 1
  });
  assert.equal(invalidConversion.ok, false);

  const invalidCurrent = checkDecreasingInventoryFitsOnHand({
    currentNativeQuantity: Number.NaN,
    canonicalQuantityPerUnit: 1000,
    decreaseCanonicalQuantity: 1
  });
  assert.equal(invalidCurrent.ok, false);
  if (!invalidCurrent.ok) assert.equal(invalidCurrent.reason, "invalid_quantity");

  const invalidIncrease = checkIncreasingInventoryFitsOnHand({
    currentNativeQuantity: 2,
    canonicalQuantityPerUnit: 1000,
    increaseCanonicalQuantity: -1
  });
  assert.equal(invalidIncrease.ok, false);
  if (!invalidIncrease.ok) assert.equal(invalidIncrease.reason, "invalid_quantity");
});

test("exact on-hand exhaustion remains accepted for decreases", () => {
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

test("hosted on-hand limit reason distinguishes floor-bound versus ceiling-bound event types", () => {
  assert.equal(onHandLimitRejectionReason("waste"), "insufficient_on_hand");
  assert.equal(onHandLimitRejectionReason("usage"), "insufficient_on_hand");
  assert.equal(onHandLimitRejectionReason("receipt"), "exceeds_on_hand_ceiling");
  assert.equal(onHandLimitRejectionReason("count"), "exceeds_on_hand_ceiling");
  assert.equal(onHandLimitRejectionReason("adjustment"), "on_hand_out_of_limits");
  assert.equal(onHandLimitRejectionReason(undefined), "on_hand_out_of_limits");
});
