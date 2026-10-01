import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  convertRecipeQuantityToInventoryUnit,
  inventoryUnitsAreCompatible
} from "../services/domain/inventoryUnits";
import { resolveSetupRecipeIngredientMapping } from "../services/domain/setupDrafts";

test("same-dimension recipe units convert into the inventory item unit", () => {
  assert.equal(inventoryUnitsAreCompatible("lb", "oz"), false);

  const ouncesToPounds = convertRecipeQuantityToInventoryUnit({
    quantity: 16,
    recipeUnit: "oz",
    inventoryUnit: "lb"
  });
  assert.equal(ouncesToPounds.ok, true);
  if (!ouncesToPounds.ok) return;
  assert.equal(ouncesToPounds.converted, true);
  assert.ok(Math.abs(ouncesToPounds.quantity - 1) < 1e-9);

  const litersToMilliliters = convertRecipeQuantityToInventoryUnit({
    quantity: 0.25,
    recipeUnit: "l",
    inventoryUnit: "ml"
  });
  assert.equal(litersToMilliliters.ok, true);
  if (!litersToMilliliters.ok) return;
  assert.equal(litersToMilliliters.converted, true);
  assert.equal(litersToMilliliters.quantity, 250);

  const exactAlias = convertRecipeQuantityToInventoryUnit({
    quantity: 2,
    recipeUnit: "pounds",
    inventoryUnit: "lb"
  });
  assert.equal(exactAlias.ok, true);
  if (!exactAlias.ok) return;
  assert.equal(exactAlias.converted, false);
  assert.equal(exactAlias.quantity, 2);
});

test("pack, unknown, and cross-dimension recipe units stay unconverted", () => {
  assert.equal(
    convertRecipeQuantityToInventoryUnit({
      quantity: 1,
      recipeUnit: "case",
      inventoryUnit: "lb"
    }).ok,
    false
  );
  assert.equal(
    convertRecipeQuantityToInventoryUnit({
      quantity: 1,
      recipeUnit: "cup",
      inventoryUnit: "ml"
    }).ok,
    false
  );
  assert.equal(
    convertRecipeQuantityToInventoryUnit({
      quantity: 100,
      recipeUnit: "g",
      inventoryUnit: "ml"
    }).ok,
    false
  );
  assert.equal(
    convertRecipeQuantityToInventoryUnit({
      quantity: 0,
      recipeUnit: "oz",
      inventoryUnit: "lb"
    }).ok,
    false
  );
});

test("setup recipe mapping resolves convertible units and skips the rest", () => {
  const converted = resolveSetupRecipeIngredientMapping({
    quantityUsedPerSale: 16,
    recipeUnit: "oz",
    inventoryUnit: "lb"
  });
  assert.equal(converted.status, "mapped");
  if (converted.status !== "mapped") return;
  assert.equal(converted.converted, true);
  assert.equal(converted.unit, "lb");
  assert.ok(Math.abs(converted.quantityUsedPerSale - 1) < 1e-9);

  const skippedPack = resolveSetupRecipeIngredientMapping({
    quantityUsedPerSale: 1,
    recipeUnit: "packs",
    inventoryUnit: "each"
  });
  assert.equal(skippedPack.status, "skipped");

  const skippedCross = resolveSetupRecipeIngredientMapping({
    quantityUsedPerSale: 50,
    recipeUnit: "ml",
    inventoryUnit: "g"
  });
  assert.equal(skippedCross.status, "skipped");
});

test("hosted setup completion surfaces skipped recipe ingredient caution", () => {
  const setupScreen = readFileSync("app/(auth)/setup.tsx", "utf8");
  const setupService = readFileSync("services/application/setup.ts", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(setupService, /resolveSetupRecipeIngredientMapping/);
  assert.doesNotMatch(
    setupService,
    /!linkedInventoryItem\s*\|\|\s*!inventoryUnitsAreCompatible/
  );
  assert.match(setupScreen, /skippedRecipeIngredients/);
  assert.match(setupScreen, /setup\.ready\.skippedIngredients\.title/);
  assert.match(setupScreen, /tone="caution"/);
  assert.match(catalog, /"setup\.ready\.skippedIngredients\.body"/);
  assert.match(catalog, /"setup\.ready\.skippedIngredients\.title\.one"/);
  assert.match(catalog, /"setup\.ready\.skippedIngredients\.title\.other"/);
});
