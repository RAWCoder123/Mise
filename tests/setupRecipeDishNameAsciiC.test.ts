import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRecipeDishNameToken,
  canonicalizeSetupRecipeDishName,
  canonicalizeSetupRecipeDishNameToken,
  normalizeCanonicalSetupRecipeDishName,
  requireCanonicalSetupRecipeDishName
} from "../services/domain/setupRecipeDishNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupRecipeDishNameIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);
const draftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const dishName = "Margherita Pizza";
const accentedDish = "Café Méxicana";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005QB pins setup recipe dish names to ASCII C", () => {
  assert.match(identitySource, /MISE-005QB/);
  assert.match(setupSource, /MISE-005QB/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRecipeDishNameToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /normalizeCanonicalSetupRecipeDishName\(recipe\.dishName\)/
  );
  assert.match(setupSource, /from "\.\.\/domain\/setupRecipeDishNameIdentity"/);
  assert.doesNotMatch(setupSource, /const menuItemName = recipe\.dishName\.trim\(\);/);

  // Leave sibling setup field trims, draft emptiness, and inventory-name keys alone.
  assert.match(draftsSource, /recipe\.dishName\.trim\(\)/);
  assert.match(setupSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);
  assert.match(setupSource, /const itemName = draft\.name\.trim\(\);/);
  assert.match(setupSource, /const ingredientName = ingredient\.itemName\.trim\(\);/);
  assert.match(setupSource, /draft\.unit\.trim\(\)\s*\|\|\s*"unit"/);
  assert.match(setupSource, /ingredient\.unit\.trim\(\)\s*\|\|\s*"unit"/);
  assert.match(setupSource, /label: attachment\.label\.trim\(\) \|\| "Setup reference"/);
  assert.match(setupSource, /supplier\.name\.trim\(\) \|\| supplier\.email\.trim\(\)/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /setupInventoryUnitIdentity/);
  assert.doesNotMatch(identitySource, /setupAttachmentLabelIdentity/);
  assert.doesNotMatch(identitySource, /setupInventoryName/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(setupSource, /normalizeCanonicalSetupInventoryUnit\(/);
});

test("ASCII C prep keeps ordinary setup recipe dish names stable", () => {
  assert.equal(asciiTrimSetupRecipeDishNameToken(`  ${dishName}  `), dishName);
  assert.equal(asciiTrimSetupRecipeDishNameToken(`\t${dishName}\n`), dishName);
  assert.equal(canonicalizeSetupRecipeDishNameToken(`  ${dishName}  `), dishName);
  assert.equal(canonicalizeSetupRecipeDishName(`  ${dishName}  `), dishName);
  assert.equal(normalizeCanonicalSetupRecipeDishName(`  ${dishName}  `), dishName);
  assert.equal(requireCanonicalSetupRecipeDishName(`  ${dishName}  `), dishName);

  assert.equal(canonicalizeSetupRecipeDishName(accentedDish), accentedDish);
  assert.equal(normalizeCanonicalSetupRecipeDishName(accentedDish), accentedDish);
});

test("Unicode em-space / NBSP padding cannot invent clean setup recipe dish names", () => {
  const padded = `${em}${dishName}${em}`;
  const nbspDish = `${nbsp}${dishName}${nbsp}`;
  const internalEm = `Margherita${em}Pizza`;
  const internalNbsp = `Margherita${nbsp}Pizza`;

  // Inventing proof: Unicode trim would invent the clean menu item name.
  assert.equal(padded.trim(), dishName);
  assert.equal(nbspDish.trim(), dishName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupRecipeDishNameToken(padded), padded);
  assert.equal(canonicalizeSetupRecipeDishNameToken(padded), null);
  assert.equal(canonicalizeSetupRecipeDishNameToken(nbspDish), null);
  assert.equal(canonicalizeSetupRecipeDishName(padded), null);
  assert.equal(canonicalizeSetupRecipeDishName(nbspDish), null);

  assert.throws(
    () => normalizeCanonicalSetupRecipeDishName(padded),
    /Setup recipe dish name is invalid\./
  );
  assert.throws(
    () => requireCanonicalSetupRecipeDishName(nbspDish),
    /Setup recipe dish name is invalid\./
  );

  // Soft empty still skips without inventing a dish name from padding alone.
  assert.equal(normalizeCanonicalSetupRecipeDishName(`${em}${em}`), null);
  assert.equal(normalizeCanonicalSetupRecipeDishName(`${nbsp}`), null);
  assert.equal(normalizeCanonicalSetupRecipeDishName("   "), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupRecipeDishNameToken(internalEm), internalEm);
  assert.equal(canonicalizeSetupRecipeDishName(internalNbsp), internalNbsp);
  assert.equal(normalizeCanonicalSetupRecipeDishName(internalEm), internalEm);
});

test("soft empty stays null without inventing text; controls and non-strings fail closed", () => {
  assert.equal(normalizeCanonicalSetupRecipeDishName(undefined), null);
  assert.equal(normalizeCanonicalSetupRecipeDishName(""), null);
  assert.equal(normalizeCanonicalSetupRecipeDishName("   "), null);
  assert.equal(normalizeCanonicalSetupRecipeDishName(`${em}${em}`), null);
  assert.equal(normalizeCanonicalSetupRecipeDishName(`${nbsp}`), null);
  assert.equal(canonicalizeSetupRecipeDishName(`${em}${em}`), null);

  assert.throws(
    () => requireCanonicalSetupRecipeDishName(`${em}${em}`),
    /Setup recipe dish name is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupRecipeDishName(123),
    /Setup recipe dish name is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupRecipeDishName(`\u0001${dishName}`),
    /Setup recipe dish name is invalid\./
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCanonicalSetupRecipeDishName(`${dishName}\t`), dishName);
  assert.throws(
    () => normalizeCanonicalSetupRecipeDishName(`${dishName}\u0007`),
    /Setup recipe dish name is invalid\./
  );
});
