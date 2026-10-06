import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeSetupInventoryItemKey,
  setupInventoryItemKeysMatch
} from "../services/application/setup";

const applicationSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

test("MISE-005JJ pins setup inventory-name identity normalize to ASCII C case fold", () => {
  assert.match(applicationSource, /MISE-005JJ/);
  assert.match(
    applicationSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = applicationSource.slice(
    applicationSource.indexOf("export function normalizeSetupInventoryItemKey("),
    applicationSource.indexOf("export function setupInventoryItemKeysMatch(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(
    applicationSource,
    /inventoryItemsByName\.set\(normalizeSetupInventoryItemKey\(itemName\),/
  );
  assert.match(
    applicationSource,
    /const ingredientKey = normalizeSetupInventoryItemKey\(ingredientName\);/
  );
  assert.doesNotMatch(
    applicationSource,
    /itemName\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    applicationSource,
    /ingredientName\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary setup inventory names stable", () => {
  assert.equal(normalizeSetupInventoryItemKey("  Chicken Breast  "), "chicken breast");
  assert.equal(normalizeSetupInventoryItemKey("CHICKEN BREAST"), "chicken breast");
  assert.equal(
    normalizeSetupInventoryItemKey("Chicken Breast"),
    normalizeSetupInventoryItemKey("chicken breast")
  );
  assert.equal(setupInventoryItemKeysMatch("Flour", "flour"), true);
});

test("ASCII C fold does not invent Kelvin-sign setup inventory identity", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken breast".
  assert.equal(normalizeSetupInventoryItemKey("Khicken Breast"), "Khicken breast");
  assert.notEqual(
    normalizeSetupInventoryItemKey("Khicken Breast"),
    normalizeSetupInventoryItemKey("Chicken Breast")
  );
  assert.equal(
    setupInventoryItemKeysMatch("Khicken Breast", "Chicken Breast"),
    false
  );

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode `\s` break.
  assert.equal(
    normalizeSetupInventoryItemKey("Chicken\u00a0Breast"),
    "chicken\u00a0breast"
  );
  assert.notEqual(
    normalizeSetupInventoryItemKey("Chicken\u00a0Breast"),
    normalizeSetupInventoryItemKey("Chicken Breast")
  );
});
