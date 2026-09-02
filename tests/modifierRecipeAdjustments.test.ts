import assert from "node:assert/strict";
import test from "node:test";

import {
  applyVerifiedModifierDeltas,
  normalizeModifierRecipeAdjustment,
  presentModifierQuantityDelta,
  requireModifierQuantityDelta
} from "../services/domain/modifierRecipeAdjustments";

const base = {
  id: "adj-1",
  restaurantId: "rest-1",
  recipeVersionId: "ver-1",
  externalModifierId: "mod-extra-avo",
  modifierName: "Extra avocado",
  inventoryItemId: "item-avo",
  quantityDelta: 40,
  canonicalUnit: "g" as const,
  verificationStatus: "verified" as const,
  createdAt: "2026-09-02T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z"
};

test("normalizeModifierRecipeAdjustment accepts snake_case and camelCase rows", () => {
  const fromSnake = normalizeModifierRecipeAdjustment({
    id: "adj-2",
    restaurant_id: "rest-1",
    recipe_version_id: "ver-1",
    external_modifier_id: "mod-no-onion",
    modifier_name: "No onion",
    inventory_item_id: "item-onion",
    quantity_delta: -10,
    canonical_unit: "g",
    verification_status: "draft",
    created_at: "2026-09-02T00:00:00.000Z",
    updated_at: "2026-09-02T00:00:00.000Z"
  });
  assert.equal(fromSnake.quantityDelta, -10);
  assert.equal(fromSnake.verificationStatus, "draft");

  const fromCamel = normalizeModifierRecipeAdjustment({ ...base });
  assert.equal(fromCamel.externalModifierId, "mod-extra-avo");
});

test("applyVerifiedModifierDeltas fails closed when a selected modifier lacks a verified mapping", () => {
  const baseMap = new Map([["item-avo", 100]]);
  assert.equal(
    applyVerifiedModifierDeltas({
      baseCanonicalByItemId: baseMap,
      recipeVersionId: "ver-1",
      selectedExternalModifierIds: ["mod-unknown"],
      adjustments: [base]
    }),
    null
  );
});

test("applyVerifiedModifierDeltas adds verified deltas for selected modifiers", () => {
  const next = applyVerifiedModifierDeltas({
    baseCanonicalByItemId: new Map([
      ["item-avo", 100],
      ["item-onion", 50]
    ]),
    recipeVersionId: "ver-1",
    selectedExternalModifierIds: ["mod-extra-avo"],
    adjustments: [base]
  });
  assert.ok(next);
  assert.equal(next.get("item-avo"), 140);
  assert.equal(next.get("item-onion"), 50);
});

test("requireModifierQuantityDelta rejects zero and oversized values", () => {
  assert.equal(requireModifierQuantityDelta("-2.5"), -2.5);
  assert.throws(() => requireModifierQuantityDelta(0));
  assert.throws(() => requireModifierQuantityDelta(1_000_001));
});

test("presentModifierQuantityDelta includes a leading plus for additions", () => {
  assert.equal(presentModifierQuantityDelta(base), "+40 g");
  assert.equal(
    presentModifierQuantityDelta({ ...base, quantityDelta: -12.5 }),
    "-12.5 g"
  );
});
