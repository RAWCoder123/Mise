import assert from "node:assert/strict";
import test from "node:test";

import {
  convertSourceQuantityToSubstitute,
  isActiveVerifiedSubstitution,
  listActiveVerifiedSubstitutesForItem,
  normalizeIngredientSubstitution,
  presentIngredientSubstitutionRatio,
  requireSubstitutionQuantity
} from "../services/domain/ingredientSubstitutions";

const base = {
  id: "sub-1",
  restaurantId: "rest-1",
  sourceInventoryItemId: "item-a",
  substituteInventoryItemId: "item-b",
  sourceQuantity: 1,
  substituteQuantity: 1.1,
  canonicalUnit: "g" as const,
  verificationStatus: "verified" as const,
  effectiveFrom: "2026-09-01T00:00:00.000Z",
  effectiveTo: null,
  verifiedAt: "2026-09-01T00:00:00.000Z",
  verifiedBy: "user-1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z"
};

test("normalizeIngredientSubstitution accepts snake_case and camelCase rows", () => {
  const fromSnake = normalizeIngredientSubstitution({
    id: "sub-2",
    restaurant_id: "rest-1",
    source_inventory_item_id: "item-a",
    substitute_inventory_item_id: "item-b",
    source_quantity: 2,
    substitute_quantity: 3,
    canonical_unit: "each",
    verification_status: "draft",
    effective_from: "2026-09-01T00:00:00.000Z",
    effective_to: null,
    verified_at: null,
    verified_by: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z"
  });
  assert.equal(fromSnake.canonicalUnit, "each");
  assert.equal(fromSnake.verificationStatus, "draft");
  assert.equal(fromSnake.sourceQuantity, 2);

  const fromCamel = normalizeIngredientSubstitution({ ...base });
  assert.equal(fromCamel.substituteQuantity, 1.1);
});

test("active verified substitutions convert source quantities by ratio", () => {
  assert.equal(convertSourceQuantityToSubstitute(10, base), 11);
  assert.equal(
    convertSourceQuantityToSubstitute(10, { ...base, verificationStatus: "draft" }),
    null
  );
  assert.equal(
    isActiveVerifiedSubstitution({
      ...base,
      effectiveTo: "2026-08-01T00:00:00.000Z"
    }),
    false
  );
});

test("listActiveVerifiedSubstitutesForItem filters by source item", () => {
  const listed = listActiveVerifiedSubstitutesForItem(
    [
      base,
      { ...base, id: "sub-3", sourceInventoryItemId: "item-c" },
      { ...base, id: "sub-4", verificationStatus: "expired" }
    ],
    "item-a"
  );
  assert.deepEqual(
    listed.map((entry) => entry.id),
    ["sub-1"]
  );
});

test("requireSubstitutionQuantity rejects non-positive and oversized values", () => {
  assert.equal(requireSubstitutionQuantity("2.5"), 2.5);
  assert.throws(() => requireSubstitutionQuantity(0));
  assert.throws(() => requireSubstitutionQuantity(1_000_001));
});

test("presentIngredientSubstitutionRatio trims trailing zeros", () => {
  assert.equal(presentIngredientSubstitutionRatio(base), "1 g → 1.1 g");
});
