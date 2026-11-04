import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesDishMenuItemName,
  canonicalizeRecipesDishMenuItemName,
  normalizeRecipesDishMenuItemName
} from "../services/domain/presentationRecipesDishMenuItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecipesDishMenuItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const recipesSource = readFileSync(
  new URL("../app/settings/recipes.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const dishName = "Chicken Bowl";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XT pins Recipes dish menu_item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005XT/);
  assert.match(recipesSource, /MISE-005XT/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesDishMenuItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesDishMenuItemNameIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesDishMenuItemName\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesDishMenuItemName\(item\.menu_item_name\)\s*\|\|\s*t\("recipes\.row\.menuItemName\.none"\)/
  );
  assert.doesNotMatch(recipesSource, /<Text style=\{styles\.recipeName\}>\{item\.menu_item_name\}<\/Text>/);
  assert.doesNotMatch(
    recipesSource,
    /setNotice\(t\("recipes\.notice\.confirmed", \{\s*item: item\.menu_item_name\s*\}\)\)/
  );

  assert.match(catalogSource, /"recipes\.row\.menuItemName\.none": "Dish"/);
  assert.match(catalogSource, /"recipes\.row\.menuItemName\.none": "Plato"/);
  assert.match(catalogSource, /"recipes\.row\.menuItemName\.none": "菜品"/);

  // Leave Recipes ingredient.itemName alone (open #1067 / MISE-005XG).
  assert.doesNotMatch(recipesSource, /normalizeRecipesIngredientItemName/);
  assert.match(recipesSource, /\{ingredient\.itemName\}/);

  // Leave recipes.notice.linked draft tokens alone.
  assert.match(
    recipesSource,
    /setNotice\(t\("recipes\.notice\.linked", \{\s*ingredient: selectedInventoryItem\.item_name,\s*dish: menuItemName\s*\}\)\)/
  );

  // Leave POS missing-recipe badge labels on raw menu names.
  assert.match(
    recipesSource,
    /visibleSummary\.posItemsMissingRecipes\.map\(\(itemName\) =>/
  );

  // Leave React list keys on raw menu_item_name (not presentation chrome).
  assert.match(recipesSource, /key=\{item\.menu_item_name\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationRecipesIngredientItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identityCode, /recipeSettingsIdentity/);
  assert.doesNotMatch(identityCode, /presentationSetupFallbackLabelIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRecipesDishMenuItemName(dishName), dishName);
  assert.equal(normalizeRecipesDishMenuItemName(` ${dishName} `), dishName);
  assert.equal(normalizeRecipesDishMenuItemName(`Plato ${dishName}`), `Plato ${dishName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Recipes dish names", () => {
  const padded = `${em}${dishName}${em}`;
  const nbspName = `${nbsp}${dishName}${nbsp}`;
  const internalEm = `Chicken${em}Bowl`;
  const internalNbsp = `Chicken${nbsp}Bowl`;

  // Inventing proof: Unicode trim would invent the clean dish name.
  assert.equal(padded.trim(), dishName);
  assert.equal(nbspName.trim(), dishName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipesDishMenuItemName(padded), padded);
  assert.equal(canonicalizeRecipesDishMenuItemName(padded), null);
  assert.equal(canonicalizeRecipesDishMenuItemName(nbspName), null);
  assert.equal(normalizeRecipesDishMenuItemName(padded), null);
  assert.equal(normalizeRecipesDishMenuItemName(nbspName), null);
  assert.equal(normalizeRecipesDishMenuItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesDishMenuItemName(internalEm), internalEm);
  assert.equal(normalizeRecipesDishMenuItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipesDishMenuItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Recipes dish names", () => {
  assert.equal(normalizeRecipesDishMenuItemName(undefined), null);
  assert.equal(normalizeRecipesDishMenuItemName(null), null);
  assert.equal(normalizeRecipesDishMenuItemName(""), null);
  assert.equal(normalizeRecipesDishMenuItemName("   "), null);
  assert.equal(normalizeRecipesDishMenuItemName(123 as unknown as string), null);
  assert.equal(normalizeRecipesDishMenuItemName(`\u0001${dishName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesDishMenuItemName(`${dishName}\t`), dishName);
  assert.equal(normalizeRecipesDishMenuItemName(`${dishName}\u0007`), null);
  assert.equal(normalizeRecipesDishMenuItemName(em), null);
});

test("Recipes dish bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking dish identity on the
  // recipeName Text and recipes.notice.confirmed interpolation.
  assert.equal(normalizeRecipesDishMenuItemName(""), null);
  assert.equal(normalizeRecipesDishMenuItemName(em), null);
  assert.equal(normalizeRecipesDishMenuItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    recipesSource,
    /normalizeRecipesDishMenuItemName\(item\.menu_item_name\)\s*\|\|\s*t\("recipes\.row\.menuItemName\.none"\)/
  );
});

test("Recipes dish menu item name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${dishName}${em}`;
  assert.notEqual(asciiTrimRecipesDishMenuItemName(padded), padded.trim());
  assert.equal(normalizeRecipesDishMenuItemName(padded), null);
  assert.equal(normalizeRecipesDishMenuItemName(`\t${dishName}\n`), dishName);
});
