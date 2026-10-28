import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipeAuthorityMenuItemNameToken,
  canonicalizeRecipeAuthorityMenuItemNameToken,
  normalizeRecipeAuthorityMenuItemName
} from "../services/repositories/recipeAuthorityMenuItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/recipeAuthorityMenuItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const menuItemName = "Margherita Pizza";
const accentedName = "Café Méxicana";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SW pins recipe-authority hydrate menuItemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005SW/);
  assert.match(repositorySource, /MISE-005SW/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipeAuthorityMenuItemNameToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    repositorySource,
    /from "\.\/recipeAuthorityMenuItemNameIdentity"/
  );
  assert.match(
    repositorySource,
    /normalizeRecipeAuthorityMenuItemName\(/
  );

  const parseStart = repositorySource.indexOf("function parseRecipeAuthorityState(");
  const parseEnd = repositorySource.indexOf(
    "function parseSupplierOrderSentWorkflowResponse("
  );
  assert.ok(parseStart > 0 && parseEnd > parseStart);
  const parseBody = repositorySource.slice(parseStart, parseEnd);
  assert.match(parseBody, /normalizeRecipeAuthorityMenuItemName\(/);
  assert.doesNotMatch(parseBody, /payload\.menuItemName\.trim\(\)/);
  // Leave menuItemId hydrate untrimmed on its existing contract.
  assert.match(
    parseBody,
    /const menuItemId = typeof payload\.menuItemId === "string" \? payload\.menuItemId : "";/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /inventoryRecipeMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /demoRecipeBaselineMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /accountDeletionErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /exportRestaurantDataErrorMessageIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary recipe-authority menu item names stable", () => {
  assert.equal(asciiTrimRecipeAuthorityMenuItemNameToken(`  ${menuItemName}  `), menuItemName);
  assert.equal(asciiTrimRecipeAuthorityMenuItemNameToken(`\t${menuItemName}\n`), menuItemName);
  assert.equal(canonicalizeRecipeAuthorityMenuItemNameToken(`  ${menuItemName}  `), menuItemName);
  assert.equal(normalizeRecipeAuthorityMenuItemName(`  ${menuItemName}  `), menuItemName);

  assert.equal(normalizeRecipeAuthorityMenuItemName(accentedName), accentedName);
  assert.equal(canonicalizeRecipeAuthorityMenuItemNameToken(accentedName), accentedName);
});

test("Unicode em-space / NBSP padding cannot invent clean recipe-authority menu item names", () => {
  const padded = `${em}${menuItemName}${em}`;
  const nbspName = `${nbsp}${menuItemName}${nbsp}`;
  const internalEm = `Margherita${em}Pizza`;
  const internalNbsp = `Margherita${nbsp}Pizza`;

  // Inventing proof: Unicode trim would invent the clean menu item name.
  assert.equal(padded.trim(), menuItemName);
  assert.equal(nbspName.trim(), menuItemName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipeAuthorityMenuItemNameToken(padded), padded);
  assert.equal(canonicalizeRecipeAuthorityMenuItemNameToken(padded), null);
  assert.equal(canonicalizeRecipeAuthorityMenuItemNameToken(nbspName), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(padded), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(nbspName), null);

  // Soft empty still fails closed without inventing a menu item name from padding alone.
  assert.equal(normalizeRecipeAuthorityMenuItemName(`${em}${em}`), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(`${nbsp}`), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName("   "), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipeAuthorityMenuItemNameToken(internalEm), internalEm);
  assert.equal(normalizeRecipeAuthorityMenuItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipeAuthorityMenuItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for recipe-authority hydrate", () => {
  assert.equal(normalizeRecipeAuthorityMenuItemName(undefined), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(null), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(""), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName("   "), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(123 as unknown as string), null);
  assert.equal(normalizeRecipeAuthorityMenuItemName(`\u0001${menuItemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipeAuthorityMenuItemName(`${menuItemName}\t`), menuItemName);
  assert.equal(normalizeRecipeAuthorityMenuItemName(`${menuItemName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeRecipeAuthorityMenuItemName(em), null);
});
