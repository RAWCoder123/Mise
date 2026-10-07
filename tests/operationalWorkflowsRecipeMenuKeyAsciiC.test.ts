import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeRecipeMenuItemKey,
  recipeMenuItemKeysMatch
} from "../services/domain/recipeMenuItemKey";

const domainSource = readFileSync(
  new URL("../services/domain/recipeMenuItemKey.ts", import.meta.url),
  "utf8"
);
const edgeSource = readFileSync(
  new URL("../supabase/functions/operational-workflows/index.ts", import.meta.url),
  "utf8"
);

test("MISE-005JS pins operational-workflows recipe menu-item identity to ASCII C", () => {
  assert.match(domainSource, /MISE-005JS/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeRecipeMenuItemKey("),
    domainSource.indexOf("export function recipeMenuItemKeysMatch(")
  );

  assert.match(normalizeBody, /asciiCLower\(value\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s\+/);

  assert.match(
    edgeSource,
    /import \{ recipeMenuItemKeysMatch \} from "\.\.\/\.\.\/\.\.\/services\/domain\/recipeMenuItemKey\.ts"/
  );
  assert.match(edgeSource, /MISE-005JS/);
  assert.match(
    edgeSource,
    /recipeMenuItemKeysMatch\(entry\.menu_item_name, mapping\.menu_item_name\)/
  );
  assert.doesNotMatch(
    edgeSource,
    /menu_item_name\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    edgeSource,
    /menuItemName\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary recipe menu names stable", () => {
  assert.equal(normalizeRecipeMenuItemKey("  Chicken   Bowl  "), "chicken bowl");
  assert.equal(normalizeRecipeMenuItemKey("CHICKEN BOWL"), "chicken bowl");
  assert.equal(
    normalizeRecipeMenuItemKey("Chicken Bowl"),
    normalizeRecipeMenuItemKey("chicken bowl")
  );
  assert.equal(
    recipeMenuItemKeysMatch("Chicken Bowl", "  CHICKEN   BOWL  "),
    true
  );
});

test("ASCII C fold does not invent Kelvin-sign recipe menu identity", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken bowl".
  assert.equal(normalizeRecipeMenuItemKey("Khicken Bowl"), "Khicken bowl");
  assert.notEqual(
    normalizeRecipeMenuItemKey("Khicken Bowl"),
    normalizeRecipeMenuItemKey("Chicken Bowl")
  );
  assert.equal(
    recipeMenuItemKeysMatch("Khicken Bowl", "Chicken Bowl"),
    false
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
