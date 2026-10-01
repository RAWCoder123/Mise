import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanonicalUnitMatchesSuggestion,
  assertCanonicalUnitVerificationInput,
  isCanonicalUnitReady,
  suggestCanonicalUnitVerification
} from "../services/domain/inventoryCanonicalUnit";

test("standard mass units lock to grams without manager override", () => {
  const suggestion = suggestCanonicalUnitVerification("lb");
  assert.equal(suggestion.kind, "standard");
  assert.equal(suggestion.locked, true);
  assert.equal(suggestion.canonicalUnit, "g");
  assert.equal(suggestion.canonicalQuantityPerUnit, 453.59237);
});

test("pack units require a manual manager conversion", () => {
  const suggestion = suggestCanonicalUnitVerification("case");
  assert.equal(suggestion.kind, "manual");
  assert.equal(suggestion.locked, false);
  assert.equal(suggestion.canonicalUnit, null);
  assert.equal(suggestion.canonicalQuantityPerUnit, null);
});

test("canonical readiness requires verified status and a supported unit", () => {
  assert.equal(
    isCanonicalUnitReady({
      canonical_unit: "g",
      canonical_unit_verification_status: "verified"
    }),
    true
  );
  assert.equal(
    isCanonicalUnitReady({
      canonical_unit: "g",
      canonical_unit_verification_status: "draft"
    }),
    false
  );
  assert.equal(
    isCanonicalUnitReady({
      canonical_unit: null,
      canonical_unit_verification_status: "verified"
    }),
    false
  );
});

test("verification input rejects invalid units and non-positive quantities", () => {
  assert.throws(
    () => assertCanonicalUnitVerificationInput({ canonicalUnit: "kg", canonicalQuantityPerUnit: 1 }),
    /g, ml, or each/i
  );
  assert.throws(
    () => assertCanonicalUnitVerificationInput({ canonicalUnit: "each", canonicalQuantityPerUnit: 0 }),
    /invalid/i
  );
  assert.deepEqual(
    assertCanonicalUnitVerificationInput({ canonicalUnit: "each", canonicalQuantityPerUnit: 24 }),
    { canonicalUnit: "each", canonicalQuantityPerUnit: 24 }
  );
});

test("standard-unit verification cannot diverge from the locked conversion", () => {
  assert.throws(
    () => assertCanonicalUnitMatchesSuggestion("lb", "g", 500),
    /cannot be overridden/i
  );
  assert.doesNotThrow(() => assertCanonicalUnitMatchesSuggestion("lb", "g", 453.59237));
  assert.doesNotThrow(() => assertCanonicalUnitMatchesSuggestion("case", "each", 24));
});
