import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesIngredientAccessibilityItemName,
  canonicalizeRecipesIngredientAccessibilityItemName,
  normalizeRecipesIngredientAccessibilityItemName
} from "../services/domain/presentationRecipesIngredientAccessibilityItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecipesIngredientAccessibilityItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const recipesSource = readFileSync(
  new URL("../app/settings/recipes.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005ABQ pins Settings Recipes a11y ingredient.itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABQ/);
  assert.match(recipesSource, /MISE-005ABQ/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesIngredientAccessibilityItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesIngredientAccessibilityItemNameIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesIngredientAccessibilityItemName\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientAccessibilityItemName\(ingredient\.itemName\)\s*\|\|\s*\n?\s*t\("recipes\.row\.accessibility\.ingredient\.none"\)/
  );
  assert.doesNotMatch(
    recipesSource,
    /accessibilityLabel=\{t\("recipes\.row\.quantityAccessibility", \{ ingredient: ingredient\.itemName \}\)/
  );
  assert.doesNotMatch(
    recipesSource,
    /ingredient: ingredient\.itemName,\s*\n?\s*quantity: draftValue/
  );
  assert.doesNotMatch(
    recipesSource,
    /accessibilityLabel=\{t\("recipes\.action\.saveAccessibility", \{ ingredient: ingredient\.itemName \}\)/
  );

  assert.match(catalogSource, /"recipes\.row\.accessibility\.ingredient\.none": "Ingredient"/);
  assert.match(catalogSource, /"recipes\.row\.accessibility\.ingredient\.none": "Ingrediente"/);
  assert.match(catalogSource, /"recipes\.row\.accessibility\.ingredient\.none": "食材"/);

  // Leave ingredient name Text display and sibling tips alone.
  assert.match(recipesSource, /\{ingredient\.itemName\}/);
  assert.match(recipesSource, /unit: ingredient\.unit/);
  assert.doesNotMatch(identitySource, /presentationRecipesIngredientItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecipesIngredientUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationSetupRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRecipesIngredientAccessibilityItemName(itemName), itemName);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeRecipesIngredientAccessibilityItemName(`Case-${itemName}`),
    `Case-${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Settings Recipes a11y names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Roma${em}Tomatoes`;
  const internalNbsp = `Roma${nbsp}Tomatoes`;

  // Inventing proof: Unicode trim would invent the clean ingredient name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipesIngredientAccessibilityItemName(padded), padded);
  assert.equal(canonicalizeRecipesIngredientAccessibilityItemName(padded), null);
  assert.equal(canonicalizeRecipesIngredientAccessibilityItemName(nbspName), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(padded), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(nbspName), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesIngredientAccessibilityItemName(internalEm), internalEm);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings Recipes a11y names", () => {
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(undefined), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(null), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(""), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName("   "), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(123 as unknown as string), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(em), null);
});

test("Settings Recipes a11y bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking ingredient into a11y.
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(""), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(em), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientAccessibilityItemName\(ingredient\.itemName\)\s*\|\|\s*\n?\s*t\("recipes\.row\.accessibility\.ingredient\.none"\)/
  );
});

test("Settings Recipes a11y ingredient.itemName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimRecipesIngredientAccessibilityItemName(padded), padded.trim());
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(padded), null);
  assert.equal(normalizeRecipesIngredientAccessibilityItemName(`\t${itemName}\n`), itemName);
});
