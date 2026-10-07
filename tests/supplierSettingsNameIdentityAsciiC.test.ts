import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalSupplierSettingsDisplayName,
  isValidSupplierSettingsDisplayName,
  supplierSettingsDisplayNamesMatch
} from "../services/domain/supplierSettingsNameIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/supplierSettingsNameIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/suppliers.tsx", import.meta.url),
  "utf8"
);

test("MISE-005JV pins suppliers-settings display-name identity to ASCII C", () => {
  assert.match(domainSource, /MISE-005JV/);
  assert.match(domainSource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(domainSource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = domainSource.slice(
    domainSource.indexOf("export function canonicalSupplierSettingsDisplayName("),
    domainSource.indexOf("export function supplierSettingsDisplayNamesMatch(")
  );

  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    screenSource,
    /import \{\s*canonicalSupplierSettingsDisplayName,\s*isValidSupplierSettingsDisplayName,\s*supplierSettingsDisplayNamesMatch\s*\} from "\.\.\/\.\.\/services\/domain\/supplierSettingsNameIdentity"/
  );
  assert.match(screenSource, /MISE-005JV/);
  assert.match(screenSource, /canonicalSupplierSettingsDisplayName\(/);
  assert.match(screenSource, /isValidSupplierSettingsDisplayName\(/);
  assert.match(screenSource, /supplierSettingsDisplayNamesMatch\(/);
  assert.doesNotMatch(screenSource, /function canonicalSupplierName\(/);
  assert.doesNotMatch(screenSource, /function isValidSupplierName\(/);
  assert.doesNotMatch(screenSource, /\.trim\(\)\.replace\(\/\\s\+\/g/);
});

test("ASCII C display prep keeps ordinary suppliers-settings names stable", () => {
  assert.equal(
    canonicalSupplierSettingsDisplayName("  Fresh\tPoultry  "),
    "Fresh Poultry"
  );
  assert.equal(
    canonicalSupplierSettingsDisplayName("Café Supply"),
    "Café Supply"
  );
  assert.equal(
    supplierSettingsDisplayNamesMatch("  Fresh Poultry  ", "Fresh Poultry"),
    true
  );
  assert.equal(isValidSupplierSettingsDisplayName("  Fresh Poultry  "), true);
  assert.equal(isValidSupplierSettingsDisplayName(""), false);
  assert.equal(isValidSupplierSettingsDisplayName("Bad\nName"), false);
});

test("ASCII C display prep folds NBSP and refuses non-C whitespace collapse", () => {
  // Pasted NBSP is folded like MISE-005B / private.normalize_supplier_display_name.
  assert.equal(
    canonicalSupplierSettingsDisplayName("Café\u00a0Supply"),
    "Café Supply"
  );
  assert.equal(
    supplierSettingsDisplayNamesMatch("Café\u00a0Supply", "Café Supply"),
    true
  );

  // Unicode em-space is outside C [[:space:]]; leave it alone rather than
  // invent equality Unicode `\s` would create.
  assert.equal(
    canonicalSupplierSettingsDisplayName("A\u2003B"),
    "A\u2003B"
  );
  assert.notEqual(
    canonicalSupplierSettingsDisplayName("A\u2003B"),
    canonicalSupplierSettingsDisplayName("A B")
  );
  assert.equal(supplierSettingsDisplayNamesMatch("A\u2003B", "A B"), false);

  // Display prep preserves case and accents; Kelvin is not folded to k.
  assert.equal(
    canonicalSupplierSettingsDisplayName("Kelvin Foods"),
    "Kelvin Foods"
  );
  assert.notEqual(
    canonicalSupplierSettingsDisplayName("Kelvin Foods"),
    canonicalSupplierSettingsDisplayName("Kelvin Foods")
  );
});
