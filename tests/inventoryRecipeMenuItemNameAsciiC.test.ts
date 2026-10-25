import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryRecipeMenuItemNameToken,
  canonicalizeInventoryRecipeMenuItemName,
  canonicalizeInventoryRecipeMenuItemNameToken,
  requireCanonicalInventoryRecipeMenuItemName
} from "../services/domain/inventoryRecipeMenuItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryRecipeMenuItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const menuItemName = "Margherita Pizza";
const accentedName = "Café Méxicana";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QC pins inventory recipe-mapping menuItemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005QC/);
  assert.match(applicationSource, /MISE-005QC/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryRecipeMenuItemNameToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalInventoryRecipeMenuItemName\(input\.menuItemName\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/inventoryRecipeMenuItemNameIdentity"/
  );
  assert.doesNotMatch(
    applicationSource,
    /const menuItemName = input\.menuItemName\.trim\(\);/
  );

  // Leave sibling inventory application field trims alone.
  assert.match(applicationSource, /const inventoryItemId = input\.inventoryItemId\.trim\(\);/);
  assert.match(applicationSource, /const unit = input\.unit\.trim\(\);/);
  assert.match(
    applicationSource,
    /mapping\.menu_item_name\.trim\(\)\.toLowerCase\(\) === menuItemName\.toLowerCase\(\)/
  );

  // Do not rewrite sibling tips / modules inside this identity file.
  // Application may also import #763/#767 helpers after those tips land; do not
  // cross-assert their absence from inventory.ts.
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /inventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /setupRecipeDishNameIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary recipe-mapping menu item names stable", () => {
  assert.equal(asciiTrimInventoryRecipeMenuItemNameToken(`  ${menuItemName}  `), menuItemName);
  assert.equal(asciiTrimInventoryRecipeMenuItemNameToken(`\t${menuItemName}\n`), menuItemName);
  assert.equal(canonicalizeInventoryRecipeMenuItemNameToken(`  ${menuItemName}  `), menuItemName);
  assert.equal(canonicalizeInventoryRecipeMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(requireCanonicalInventoryRecipeMenuItemName(`  ${menuItemName}  `), menuItemName);

  assert.equal(canonicalizeInventoryRecipeMenuItemName(accentedName), accentedName);
  assert.equal(requireCanonicalInventoryRecipeMenuItemName(accentedName), accentedName);
});

test("Unicode em-space / NBSP padding cannot invent clean recipe-mapping menu item names", () => {
  const padded = `${em}${menuItemName}${em}`;
  const nbspName = `${nbsp}${menuItemName}${nbsp}`;
  const internalEm = `Margherita${em}Pizza`;
  const internalNbsp = `Margherita${nbsp}Pizza`;

  // Inventing proof: Unicode trim would invent the clean menu item name.
  assert.equal(padded.trim(), menuItemName);
  assert.equal(nbspName.trim(), menuItemName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInventoryRecipeMenuItemNameToken(padded), padded);
  assert.equal(canonicalizeInventoryRecipeMenuItemNameToken(padded), null);
  assert.equal(canonicalizeInventoryRecipeMenuItemNameToken(nbspName), null);
  assert.equal(canonicalizeInventoryRecipeMenuItemName(padded), null);
  assert.equal(canonicalizeInventoryRecipeMenuItemName(nbspName), null);

  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(padded),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(nbspName),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );

  // Soft empty still fails closed without inventing a menu item name from padding alone.
  assert.equal(canonicalizeInventoryRecipeMenuItemName(`${em}${em}`), null);
  assert.equal(canonicalizeInventoryRecipeMenuItemName(`${nbsp}`), null);
  assert.equal(canonicalizeInventoryRecipeMenuItemName("   "), null);
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(`${em}${em}`),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryRecipeMenuItemNameToken(internalEm), internalEm);
  assert.equal(canonicalizeInventoryRecipeMenuItemName(internalNbsp), internalNbsp);
  assert.equal(requireCanonicalInventoryRecipeMenuItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed with the existing empty-gate contract", () => {
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName("   "),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(123),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(`\u0001${menuItemName}`),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(requireCanonicalInventoryRecipeMenuItemName(`${menuItemName}\t`), menuItemName);
  assert.throws(
    () => requireCanonicalInventoryRecipeMenuItemName(`${menuItemName}\u0007`),
    (error: unknown) =>
      error instanceof Error && error.message === "Enter the POS menu item name."
  );
});
