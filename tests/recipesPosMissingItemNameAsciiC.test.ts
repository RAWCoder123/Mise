import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesPosMissingItemName,
  canonicalizeRecipesPosMissingItemName,
  normalizeRecipesPosMissingItemName
} from "../services/domain/presentationRecipesPosMissingItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRecipesPosMissingItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const recipesSource = readFileSync(new URL("../app/settings/recipes.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Chicken Bowl";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XV pins Recipes POS missing-recipe badge itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XV/);
  assert.match(recipesSource, /MISE-005XV/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesPosMissingItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesPosMissingItemNameIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesPosMissingItemName\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesPosMissingItemName\(itemName\)\s*\|\|\s*\n?\s*t\("recipes\.warning\.itemName\.none"\)/
  );
  assert.doesNotMatch(
    recipesSource,
    /<Badge key=\{itemName\} label=\{itemName\} tone="warning" \/>/
  );

  assert.match(catalogSource, /"recipes\.warning\.itemName\.none": "Menu item"/);
  assert.match(catalogSource, /"recipes\.warning\.itemName\.none": "Plato"/);
  assert.match(catalogSource, /"recipes\.warning\.itemName\.none": "菜品"/);

  // Leave recipes.notice.linked alone (open #1081 / MISE-005XU).
  assert.doesNotMatch(recipesSource, /normalizeRecipesNoticeLinkedIngredientName/);
  assert.doesNotMatch(recipesSource, /normalizeRecipesNoticeLinkedDishName/);
  assert.doesNotMatch(identitySource, /presentationRecipesNoticeLinkedIngredientIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecipesNoticeLinkedDishIdentity/);

  // Leave Recipes dish menu_item_name / confirmed alone (open #1080 / MISE-005XT).
  assert.doesNotMatch(recipesSource, /normalizeRecipesDishMenuItemName/);
  assert.match(recipesSource, /<Text style=\{styles\.recipeName\}>\{item\.menu_item_name\}<\/Text>/);
  assert.match(
    recipesSource,
    /setNotice\(t\("recipes\.notice\.confirmed", \{\s*item: item\.menu_item_name\s*\}\)\)/
  );

  // Leave Recipes ingredient.itemName row chrome alone (open #1067 / MISE-005XG).
  assert.doesNotMatch(recipesSource, /normalizeRecipesIngredientItemName/);
  assert.match(recipesSource, /\{ingredient\.itemName\}/);

  // Leave React list keys on raw itemName (not presentation chrome).
  assert.match(recipesSource, /key=\{itemName\}/);

  // Leave builder SuggestionChip onPress write-back and active Unicode-trim gate alone.
  assert.match(recipesSource, /onPress=\{\(\) => onMenuItemNameChange\(itemName\)\}/);
  assert.match(
    recipesSource,
    /active=\{menuItemName\.trim\(\)\.toLowerCase\(\) === itemName\.toLowerCase\(\)\}/
  );

  // Leave inventory-item SuggestionChip labels on raw item.item_name.
  assert.match(recipesSource, /label=\{item\.item_name\}/);

  // Leave domain posItemsMissingRecipes computation alone (executable code only;
  // the module header may name the field when documenting scope).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /posItemsMissingRecipes/);
  assert.doesNotMatch(identityCode, /miseDomain/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRecipesPosMissingItemName(itemName), itemName);
  assert.equal(normalizeRecipesPosMissingItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeRecipesPosMissingItemName(`Plato ${itemName}`),
    `Plato ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for POS missing-recipe badge names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Chicken${em}Bowl`;
  const internalNbsp = `Chicken${nbsp}Bowl`;

  // Inventing proof: Unicode trim would invent the clean menu item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipesPosMissingItemName(padded), padded);
  assert.equal(canonicalizeRecipesPosMissingItemName(padded), null);
  assert.equal(canonicalizeRecipesPosMissingItemName(nbspName), null);
  assert.equal(normalizeRecipesPosMissingItemName(padded), null);
  assert.equal(normalizeRecipesPosMissingItemName(nbspName), null);
  assert.equal(normalizeRecipesPosMissingItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesPosMissingItemName(internalEm), internalEm);
  assert.equal(normalizeRecipesPosMissingItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipesPosMissingItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS missing-recipe badge names", () => {
  assert.equal(normalizeRecipesPosMissingItemName(undefined), null);
  assert.equal(normalizeRecipesPosMissingItemName(null), null);
  assert.equal(normalizeRecipesPosMissingItemName(""), null);
  assert.equal(normalizeRecipesPosMissingItemName("   "), null);
  assert.equal(normalizeRecipesPosMissingItemName(em), null);
  assert.equal(normalizeRecipesPosMissingItemName(123 as unknown as string), null);
  assert.equal(normalizeRecipesPosMissingItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesPosMissingItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeRecipesPosMissingItemName(`${itemName}\n`), itemName);
  assert.equal(normalizeRecipesPosMissingItemName(`\t${itemName}`), itemName);
  assert.equal(normalizeRecipesPosMissingItemName(`${itemName}\u0007`), null);
});

test("POS missing-recipe badge bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking menu-item identity
  // on the warning Badge and builder SuggestionChip labels.
  assert.equal(normalizeRecipesPosMissingItemName(""), null);
  assert.equal(normalizeRecipesPosMissingItemName(em), null);
  assert.equal(normalizeRecipesPosMissingItemName(nbsp), null);
  assert.match(
    recipesSource,
    /normalizeRecipesPosMissingItemName\(itemName\)\s*\|\|\s*\n?\s*t\("recipes\.warning\.itemName\.none"\)/
  );
  assert.equal(
    normalizeRecipesPosMissingItemName(em) || "Menu item",
    "Menu item"
  );
});

test("POS missing-recipe badge itemName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimRecipesPosMissingItemName(padded), padded.trim());
  assert.equal(normalizeRecipesPosMissingItemName(padded), null);
  assert.equal(normalizeRecipesPosMissingItemName(`\t${itemName}\n`), itemName);
});
