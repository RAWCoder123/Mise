import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeRecipeSettingsNameKey,
  recipeSettingsNameKeysMatch,
  trimRecipeSettingsMenuItemName
} from "../services/domain/recipeSettingsIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/recipeSettingsIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/recipes.tsx", import.meta.url),
  "utf8"
);

test("MISE-005JT pins recipes-settings name identity to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JT/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeRecipeSettingsNameKey("),
    domainSource.indexOf("export function recipeSettingsNameKeysMatch(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(
    screenSource,
    /import \{\s*recipeSettingsNameKeysMatch,\s*trimRecipeSettingsMenuItemName\s*\} from "\.\.\/\.\.\/services\/domain\/recipeSettingsIdentity"/
  );
  assert.match(screenSource, /MISE-005JT/);
  assert.match(
    screenSource,
    /recipeSettingsNameKeysMatch\(item\.item_name, newInventoryItemName\)/
  );
  assert.match(
    screenSource,
    /recipeSettingsNameKeysMatch\(menuItemName, itemName\)/
  );
  assert.match(
    screenSource,
    /trimRecipeSettingsMenuItemName\(newMenuItemName\)/
  );
  assert.doesNotMatch(
    screenSource,
    /newInventoryItemName\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    screenSource,
    /item\.item_name\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    screenSource,
    /menuItemName\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    screenSource,
    /itemName\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    screenSource,
    /newMenuItemName\.trim\(\)/
  );
});

test("ASCII C fold keeps ordinary recipes-settings names stable", () => {
  assert.equal(normalizeRecipeSettingsNameKey("  Chicken Breast  "), "chicken breast");
  assert.equal(normalizeRecipeSettingsNameKey("CHICKEN BREAST"), "chicken breast");
  assert.equal(
    normalizeRecipeSettingsNameKey("Chicken Breast"),
    normalizeRecipeSettingsNameKey("chicken breast")
  );
  assert.equal(
    recipeSettingsNameKeysMatch("Chicken Breast", "  CHICKEN BREAST  "),
    true
  );
  assert.equal(trimRecipeSettingsMenuItemName("  Chicken Bowl  "), "Chicken Bowl");
});

test("ASCII C fold does not invent Kelvin-sign recipes-settings identity", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken breast".
  assert.equal(normalizeRecipeSettingsNameKey("Khicken Breast"), "Khicken breast");
  assert.notEqual(
    normalizeRecipeSettingsNameKey("Khicken Breast"),
    normalizeRecipeSettingsNameKey("Chicken Breast")
  );
  assert.equal(
    recipeSettingsNameKeysMatch("Khicken Breast", "Chicken Breast"),
    false
  );

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode trim target.
  assert.equal(
    normalizeRecipeSettingsNameKey("\u00a0Chicken Breast\u00a0"),
    "\u00a0chicken breast\u00a0"
  );
  assert.notEqual(
    normalizeRecipeSettingsNameKey("\u00a0Chicken Breast\u00a0"),
    normalizeRecipeSettingsNameKey("Chicken Breast")
  );
  assert.equal(trimRecipeSettingsMenuItemName("\u00a0Chicken\u00a0"), "\u00a0Chicken\u00a0");
});
