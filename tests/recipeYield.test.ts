import assert from "node:assert/strict";
import test from "node:test";

import {
  computeRawUsageMultiplier,
  normalizeRecipeVersionYield,
  presentRecipeYieldReadout,
  requireRecipeYieldFactor,
  requireServingQuantity,
  requireYieldPercentAsFactor,
  selectCurrentRecipeVersionYield,
  type RecipeVersionYield
} from "../services/domain/recipeYield";

function version(overrides: Partial<RecipeVersionYield> = {}): RecipeVersionYield {
  return {
    id: "rv-1",
    restaurantId: "rest-1",
    menuItemId: "menu-1",
    status: "verified",
    servingQuantity: 1,
    prepYield: 1,
    cookingYield: 1,
    versionNumber: 1,
    effectiveFrom: "2020-01-01T00:00:00.000Z",
    effectiveTo: null,
    locationId: null,
    ...overrides
  };
}

test("computeRawUsageMultiplier divides serving by prep and cook yields", () => {
  assert.equal(computeRawUsageMultiplier(1, 0.95, 0.9), 1.1696);
  assert.equal(computeRawUsageMultiplier(2, 1, 1), 2);
  assert.equal(computeRawUsageMultiplier(1, 0, 1), null);
  assert.equal(computeRawUsageMultiplier(1, 1.1, 1), null);
});

test("require helpers reject impossible yield inputs", () => {
  assert.equal(requireRecipeYieldFactor(0.95), 0.95);
  assert.equal(requireServingQuantity(2), 2);
  assert.equal(requireYieldPercentAsFactor(95), 0.95);
  assert.throws(() => requireRecipeYieldFactor(0), /greater than 0/);
  assert.throws(() => requireRecipeYieldFactor(1.1), /at most 1/);
  assert.throws(() => requireServingQuantity(0), /greater than 0/);
  assert.throws(() => requireServingQuantity(10001), /no more than/);
  assert.throws(() => requireYieldPercentAsFactor(0), /greater than 0/);
  assert.throws(() => requireYieldPercentAsFactor(101), /at most 100/);
});

test("normalizeRecipeVersionYield accepts snake_case and camelCase rows", () => {
  const normalized = normalizeRecipeVersionYield({
    id: "rv-9",
    restaurant_id: "rest-1",
    menu_item_id: "menu-1",
    status: "draft",
    serving_quantity: 2,
    prep_yield: 0.9,
    cooking_yield: 0.85,
    version_number: 3,
    effective_from: "2026-01-01T00:00:00.000Z",
    effective_to: null,
    pos_location_id: null
  });
  assert.equal(normalized.prepYield, 0.9);
  assert.equal(normalized.cookingYield, 0.85);
  assert.equal(normalized.versionNumber, 3);
  assert.equal(normalized.locationId, null);
});

test("presentRecipeYieldReadout never invents recorded yields", () => {
  assert.deepEqual(presentRecipeYieldReadout(null), { status: "missing" });
  assert.deepEqual(presentRecipeYieldReadout(version({ status: "retired" })), { status: "missing" });
  assert.deepEqual(presentRecipeYieldReadout(version({ prepYield: 0 })), { status: "missing" });

  const recorded = presentRecipeYieldReadout(version({ prepYield: 0.95, cookingYield: 0.9 }));
  assert.equal(recorded.status, "recorded");
  if (recorded.status === "recorded") {
    assert.equal(recorded.prepYield, 0.95);
    assert.equal(recorded.cookingYield, 0.9);
    assert.equal(recorded.rawUsageMultiplier, 1.1696);
    assert.equal(recorded.versionStatus, "verified");
  }
});

test("selectCurrentRecipeVersionYield prefers verified restaurant-wide active versions", () => {
  const at = new Date("2026-09-01T12:00:00.000Z");
  const selected = selectCurrentRecipeVersionYield(
    [
      version({
        id: "draft-wide",
        status: "draft",
        versionNumber: 3,
        prepYield: 0.8
      }),
      version({
        id: "verified-location",
        status: "verified",
        locationId: "loc-1",
        versionNumber: 2,
        prepYield: 0.7
      }),
      version({
        id: "verified-wide",
        status: "verified",
        versionNumber: 1,
        prepYield: 0.95
      }),
      version({
        id: "future",
        status: "verified",
        versionNumber: 9,
        effectiveFrom: "2099-01-01T00:00:00.000Z",
        prepYield: 0.5
      }),
      version({
        id: "other-menu",
        menuItemId: "menu-2",
        status: "verified",
        prepYield: 0.6
      })
    ],
    "menu-1",
    at
  );

  assert.equal(selected?.id, "verified-wide");
  assert.equal(selectCurrentRecipeVersionYield([], "menu-1", at), null);
  assert.equal(selectCurrentRecipeVersionYield([version()], "  ", at), null);
});
