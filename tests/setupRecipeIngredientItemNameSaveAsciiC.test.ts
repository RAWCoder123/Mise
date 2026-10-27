import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRecipeIngredientItemNameSaveToken,
  canonicalizeSetupRecipeIngredientItemNameSave,
  canonicalizeSetupRecipeIngredientItemNameSaveToken,
  normalizeCanonicalSetupRecipeIngredientItemNameSave,
  requireCanonicalSetupRecipeIngredientItemNameSave
} from "../services/domain/setupRecipeIngredientItemNameSaveIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupRecipeIngredientItemNameSaveIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);
const screenSetupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const draftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const itemName = "Tomato";
const accentedName = "Café";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RP pins setup recipe ingredient itemName save identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RP/);
  assert.match(setupSource, /MISE-005RP/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRecipeIngredientItemNameSaveToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /normalizeCanonicalSetupRecipeIngredientItemNameSave\(\s*ingredient\.itemName\s*\)/
  );
  assert.match(setupSource, /from "\.\.\/domain\/setupRecipeIngredientItemNameSaveIdentity"/);
  assert.doesNotMatch(setupSource, /const ingredientName = ingredient\.itemName\.trim\(\);/);

  // Leave sibling save field trims and screen/drafts contracts alone.
  assert.match(setupSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);
  assert.match(setupSource, /const itemName = draft\.name\.trim\(\);/);
  assert.match(setupSource, /const menuItemName = recipe\.dishName\.trim\(\);/);
  assert.match(setupSource, /draft\.unit\.trim\(\)\s*\|\|\s*"unit"/);
  assert.match(setupSource, /ingredient\.unit\.trim\(\)\s*\|\|\s*"unit"/);
  assert.match(setupSource, /label: attachment\.label\.trim\(\) \|\| "Setup reference"/);
  assert.match(setupSource, /supplier\.name\.trim\(\) \|\| supplier\.email\.trim\(\)/);

  // Leave setup.tsx recipe ingredient itemName on the prior bare contract (open #901).
  assert.match(screenSetupSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(screenSetupSource, /setupRecipeIngredientItemNameSaveIdentity/);
  assert.doesNotMatch(screenSetupSource, /normalizeCanonicalSetupRecipeIngredientItemNameSave\(/);
  assert.doesNotMatch(screenSetupSource, /prepareSetupRecipeIngredientItemNameText\(/);

  // Leave setup-drafts recipe ingredient itemName on the prior bare contract (open #898).
  assert.match(draftsSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(draftsSource, /normalizeSetupDraftsRecipeIngredientItemNameText\(/);
  assert.doesNotMatch(draftsSource, /setupDraftsRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(draftsSource, /setupRecipeIngredientItemNameSaveIdentity/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeDishNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryUnitIdentity["']/);
  assert.doesNotMatch(identitySource, /from "\.\.\/miseValidation"/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /normalizeCanonicalSetupRecipeDishName/);
  assert.doesNotMatch(identitySource, /normalizeCanonicalSetupInventoryUnit/);
  assert.doesNotMatch(setupSource, /normalizeCanonicalSetupRecipeDishName\(/);
  assert.doesNotMatch(setupSource, /normalizeCanonicalSetupInventoryUnit\(/);
  assert.doesNotMatch(setupSource, /prepareSetupRecipeIngredientItemNameText\(/);
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/domain\/setupRecipeIngredientItemNameIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/domain\/setupDraftsRecipeIngredientItemNameIdentity"/
  );
  assert.doesNotMatch(setupSource, /from "\.\.\/domain\/setupRecipeDishNameIdentity"/);
  assert.doesNotMatch(setupSource, /from "\.\.\/domain\/setupInventoryUnitIdentity"/);
});

test("ASCII C prep keeps ordinary setup recipe ingredient itemName saves stable", () => {
  assert.equal(asciiTrimSetupRecipeIngredientItemNameSaveToken(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimSetupRecipeIngredientItemNameSaveToken(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSaveToken(`  ${itemName}  `), itemName);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSave(`  ${itemName}  `), itemName);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(`  ${itemName}  `), itemName);
  assert.equal(requireCanonicalSetupRecipeIngredientItemNameSave(`  ${itemName}  `), itemName);

  assert.equal(canonicalizeSetupRecipeIngredientItemNameSave(accentedName), accentedName);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(accentedName), accentedName);
  assert.equal(
    normalizeCanonicalSetupRecipeIngredientItemNameSave("San Marzano"),
    "San Marzano"
  );
});

test("Unicode em-space / NBSP padding cannot invent clean setup recipe ingredient itemName saves", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `San${em}Marzano`;
  const internalNbsp = `San${nbsp}Marzano`;

  // Inventing proof: Unicode trim would invent the clean ingredient name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupRecipeIngredientItemNameSaveToken(padded), padded);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSaveToken(padded), null);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSaveToken(nbspName), null);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSave(padded), null);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSave(nbspName), null);

  assert.throws(
    () => normalizeCanonicalSetupRecipeIngredientItemNameSave(padded),
    /Setup recipe ingredient item name is invalid\./
  );
  assert.throws(
    () => requireCanonicalSetupRecipeIngredientItemNameSave(nbspName),
    /Setup recipe ingredient item name is invalid\./
  );

  // Soft empty still skips without inventing a name from padding alone.
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(`${em}${em}`), null);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(`${nbsp}`), null);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave("   "), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSaveToken(internalEm), internalEm);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSave(internalNbsp), internalNbsp);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(internalEm), internalEm);
});

test("soft empty stays null without inventing text; controls and non-strings fail closed", () => {
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(undefined), null);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(""), null);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave("   "), null);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(`${em}${em}`), null);
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(`${nbsp}`), null);
  assert.equal(canonicalizeSetupRecipeIngredientItemNameSave(`${em}${em}`), null);

  assert.throws(
    () => requireCanonicalSetupRecipeIngredientItemNameSave(`${em}${em}`),
    /Setup recipe ingredient item name is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupRecipeIngredientItemNameSave(123),
    /Setup recipe ingredient item name is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalSetupRecipeIngredientItemNameSave(`\u0001${itemName}`),
    /Setup recipe ingredient item name is invalid\./
  );
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeCanonicalSetupRecipeIngredientItemNameSave(`${itemName}\t`), itemName);
  assert.throws(
    () => normalizeCanonicalSetupRecipeIngredientItemNameSave(`${itemName}\u0007`),
    /Setup recipe ingredient item name is invalid\./
  );
});
