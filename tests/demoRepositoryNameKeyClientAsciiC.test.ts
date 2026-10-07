import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeDemoInventoryItemKey,
  normalizeDemoMenuItemKey
} from "../services/repositories/demoRepository";

const repositorySource = readFileSync(
  new URL("../services/repositories/demoRepository.ts", import.meta.url),
  "utf8"
);

test("MISE-005JN pins demoRepository inventory/menu identity normalize to ASCII C case fold", () => {
  assert.match(repositorySource, /MISE-005JN/);
  assert.match(
    repositorySource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const inventoryNormalizeBody = repositorySource.slice(
    repositorySource.indexOf("export function normalizeDemoInventoryItemKey("),
    repositorySource.indexOf("export function normalizeDemoMenuItemKey(")
  );
  assert.match(inventoryNormalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(inventoryNormalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(inventoryNormalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(inventoryNormalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(inventoryNormalizeBody, /\\s/);

  const menuNormalizeBody = repositorySource.slice(
    repositorySource.indexOf("export function normalizeDemoMenuItemKey("),
    repositorySource.indexOf("function demoMenuItemKeysMatch(")
  );
  assert.match(menuNormalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(menuNormalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(menuNormalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(menuNormalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(menuNormalizeBody, /\\s/);

  assert.match(repositorySource, /demoSyntheticMenuItemId\(mapping\.menu_item_name\)/);
  assert.match(repositorySource, /normalizeDemoInventoryItemKey\(inventoryInput\.item_name\)/);
  assert.match(
    repositorySource,
    /demoInventoryItemKeysMatch\(item\.item_name, inventoryInput\.item_name\)/
  );
  assert.match(
    repositorySource,
    /demoMenuItemKeysMatch\(mapping\.menu_item_name, mappingInput\.menu_item_name\)/
  );
  assert.match(
    repositorySource,
    /demoInventoryItemKeysMatch\(item\.item_name, input\.item_name\)/
  );
  assert.match(
    repositorySource,
    /demoMenuItemKeysMatch\(entry\.menu_item_name, input\.menu_item_name\)/
  );
  assert.match(
    repositorySource,
    /demoMenuItemKeysMatch\(entry\.menu_item_name, input\.menuItemName\)/
  );

  assert.doesNotMatch(
    repositorySource,
    /item_name\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    repositorySource,
    /menu_item_name\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    repositorySource,
    /menuItemName\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    repositorySource,
    /inventory_item_name\.trim\(\)\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary demo inventory and menu names stable", () => {
  assert.equal(normalizeDemoInventoryItemKey("  Chicken Breast  "), "chicken breast");
  assert.equal(normalizeDemoInventoryItemKey("CHICKEN BREAST"), "chicken breast");
  assert.equal(
    normalizeDemoInventoryItemKey("Chicken Breast"),
    normalizeDemoInventoryItemKey("chicken breast")
  );

  assert.equal(normalizeDemoMenuItemKey("  Chicken Bowl  "), "chicken bowl");
  assert.equal(normalizeDemoMenuItemKey("CHICKEN BOWL"), "chicken bowl");
  assert.equal(
    normalizeDemoMenuItemKey("Chicken Bowl"),
    normalizeDemoMenuItemKey("chicken bowl")
  );
});

test("ASCII C fold does not invent Kelvin-sign demo inventory or menu identity", () => {
  // Unicode toLowerCase would fold K → k and invent "chicken breast" / "chicken bowl".
  assert.equal(normalizeDemoInventoryItemKey("Khicken Breast"), "Khicken breast");
  assert.notEqual(
    normalizeDemoInventoryItemKey("Khicken Breast"),
    normalizeDemoInventoryItemKey("Chicken Breast")
  );

  assert.equal(normalizeDemoMenuItemKey("Khicken Bowl"), "Khicken bowl");
  assert.notEqual(
    normalizeDemoMenuItemKey("Khicken Bowl"),
    normalizeDemoMenuItemKey("Chicken Bowl")
  );

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode `\s` break.
  assert.equal(
    normalizeDemoInventoryItemKey("Chicken\u00a0Breast"),
    "chicken\u00a0breast"
  );
  assert.notEqual(
    normalizeDemoInventoryItemKey("Chicken\u00a0Breast"),
    normalizeDemoInventoryItemKey("Chicken Breast")
  );
  assert.equal(
    normalizeDemoMenuItemKey("Chicken\u00a0Bowl"),
    "chicken\u00a0bowl"
  );
  assert.notEqual(
    normalizeDemoMenuItemKey("Chicken\u00a0Bowl"),
    normalizeDemoMenuItemKey("Chicken Bowl")
  );
});
