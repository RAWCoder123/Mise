import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeRecipeMenuItemKey } from "../services/application/inventory";

const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

test("MISE-005JI pins recipe menu-item identity normalize to ASCII C case fold", () => {
  assert.match(applicationSource, /MISE-005JI/);
  assert.match(
    applicationSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = applicationSource.slice(
    applicationSource.indexOf("export function normalizeRecipeMenuItemKey("),
    applicationSource.indexOf("function recipeMenuItemKeysMatch(")
  );

  assert.match(normalizeBody, /asciiCLower\(value\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s\+/);

  assert.match(
    applicationSource,
    /recipeMenuItemKeysMatch\(entry\.menuItemName, item\.menu_item_name\)/
  );
  assert.match(
    applicationSource,
    /recipeMenuItemKeysMatch\(mapping\.menu_item_name, menuItemName\)/
  );
  assert.doesNotMatch(
    applicationSource,
    /menuItemName\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    applicationSource,
    /menu_item_name\.trim\(\)\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary recipe menu names stable", () => {
  assert.equal(normalizeRecipeMenuItemKey("  Chicken   Bowl  "), "chicken bowl");
  assert.equal(normalizeRecipeMenuItemKey("CHICKEN BOWL"), "chicken bowl");
  assert.equal(
    normalizeRecipeMenuItemKey("Chicken Bowl"),
    normalizeRecipeMenuItemKey("chicken bowl")
  );
});

test("ASCII C fold does not invent Kelvin-sign recipe menu identity", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken bowl".
  assert.equal(normalizeRecipeMenuItemKey("Khicken Bowl"), "Khicken bowl");
  assert.notEqual(
    normalizeRecipeMenuItemKey("Khicken Bowl"),
    normalizeRecipeMenuItemKey("Chicken Bowl")
  );

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode `\s` break.
  assert.equal(
    normalizeRecipeMenuItemKey("Chicken\u00a0Bowl"),
    "chicken\u00a0bowl"
  );
  assert.notEqual(
    normalizeRecipeMenuItemKey("Chicken\u00a0Bowl"),
    normalizeRecipeMenuItemKey("Chicken Bowl")
  );
});
