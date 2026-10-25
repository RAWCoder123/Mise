import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryRecipeUnitToken,
  canonicalizeInventoryRecipeUnit,
  canonicalizeInventoryRecipeUnitToken,
  requireCanonicalInventoryRecipeUnit
} from "../services/domain/inventoryRecipeUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryRecipeUnitIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const unit = "lb";
const accentedUnit = "litros";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QD pins inventory recipe-mapping unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005QD/);
  assert.match(applicationSource, /MISE-005QD/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryRecipeUnitToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalInventoryRecipeUnit\(input\.unit\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/inventoryRecipeUnitIdentity"/
  );
  assert.doesNotMatch(applicationSource, /const unit = input\.unit\.trim\(\);/);

  // Leave sibling inventory application field trims alone.
  assert.match(applicationSource, /const menuItemName = input\.menuItemName\.trim\(\);/);
  assert.match(applicationSource, /const inventoryItemId = input\.inventoryItemId\.trim\(\);/);
  assert.match(
    applicationSource,
    /mapping\.menu_item_name\.trim\(\)\.toLowerCase\(\) === menuItemName\.toLowerCase\(\)/
  );

  // Do not rewrite sibling tips / modules inside this identity file.
  // Application may also import #861/#863/#767 helpers after those tips land;
  // do not cross-assert their absence from inventory.ts.
  assert.doesNotMatch(identitySource, /setupInventoryUnitIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRecipeMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*inventoryUnits["']/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary recipe-mapping units stable", () => {
  assert.equal(asciiTrimInventoryRecipeUnitToken(`  ${unit}  `), unit);
  assert.equal(asciiTrimInventoryRecipeUnitToken(`\t${unit}\n`), unit);
  assert.equal(canonicalizeInventoryRecipeUnitToken(`  ${unit}  `), unit);
  assert.equal(canonicalizeInventoryRecipeUnit(`  ${unit}  `), unit);
  assert.equal(requireCanonicalInventoryRecipeUnit(`  ${unit}  `), unit);

  assert.equal(canonicalizeInventoryRecipeUnit(accentedUnit), accentedUnit);
  assert.equal(requireCanonicalInventoryRecipeUnit(accentedUnit), accentedUnit);
});

test("Unicode em-space / NBSP padding cannot invent clean recipe-mapping units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspUnit = `${nbsp}${unit}${nbsp}`;
  const internalEm = `fl${em}oz`;
  const internalNbsp = `fl${nbsp}oz`;

  // Inventing proof: Unicode trim would invent the clean unit.
  assert.equal(padded.trim(), unit);
  assert.equal(nbspUnit.trim(), unit);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInventoryRecipeUnitToken(padded), padded);
  assert.equal(canonicalizeInventoryRecipeUnitToken(padded), null);
  assert.equal(canonicalizeInventoryRecipeUnitToken(nbspUnit), null);
  assert.equal(canonicalizeInventoryRecipeUnit(padded), null);
  assert.equal(canonicalizeInventoryRecipeUnit(nbspUnit), null);

  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(padded),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(nbspUnit),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );

  // Soft empty still fails closed without inventing a unit from padding alone.
  assert.equal(canonicalizeInventoryRecipeUnit(`${em}${em}`), null);
  assert.equal(canonicalizeInventoryRecipeUnit(`${nbsp}`), null);
  assert.equal(canonicalizeInventoryRecipeUnit("   "), null);
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(`${em}${em}`),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryRecipeUnitToken(internalEm), internalEm);
  assert.equal(canonicalizeInventoryRecipeUnit(internalNbsp), internalNbsp);
  assert.equal(requireCanonicalInventoryRecipeUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed with the existing empty-gate contract", () => {
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(`\u0001${unit}`),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(requireCanonicalInventoryRecipeUnit(`${unit}\t`), unit);
  assert.throws(
    () => requireCanonicalInventoryRecipeUnit(`${unit}\u0007`),
    (error: unknown) =>
      error instanceof Error && error.message === "Inventory unit is required."
  );
});
