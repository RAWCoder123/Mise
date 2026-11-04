import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesNoticeLinkedDishName,
  canonicalizeRecipesNoticeLinkedDishName,
  normalizeRecipesNoticeLinkedDishName
} from "../services/domain/presentationRecipesNoticeLinkedDishIdentity";
import {
  asciiTrimRecipesNoticeLinkedIngredientName,
  canonicalizeRecipesNoticeLinkedIngredientName,
  normalizeRecipesNoticeLinkedIngredientName
} from "../services/domain/presentationRecipesNoticeLinkedIngredientIdentity";

const ingredientIdentitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecipesNoticeLinkedIngredientIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const dishIdentitySource = readFileSync(
  new URL("../services/domain/presentationRecipesNoticeLinkedDishIdentity.ts", import.meta.url),
  "utf8"
);
const recipesSource = readFileSync(
  new URL("../app/settings/recipes.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const dishName = "Chicken Bowl";
const ingredientName = "Roma Tomatoes";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XU pins recipes.notice.linked ingredient and dish to ASCII C", () => {
  assert.match(ingredientIdentitySource, /MISE-005XU/);
  assert.match(dishIdentitySource, /MISE-005XU/);
  assert.match(recipesSource, /MISE-005XU/);

  assert.match(
    ingredientIdentitySource,
    /export function asciiTrimRecipesNoticeLinkedIngredientName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    dishIdentitySource,
    /export function asciiTrimRecipesNoticeLinkedDishName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesNoticeLinkedIngredientIdentity"/
  );
  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesNoticeLinkedDishIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesNoticeLinkedIngredientName\(/);
  assert.match(recipesSource, /normalizeRecipesNoticeLinkedDishName\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesNoticeLinkedIngredientName\(selectedInventoryItem\.item_name\)\s*\|\|\s*t\("recipes\.notice\.linked\.ingredient\.none"\)/
  );
  assert.match(
    recipesSource,
    /normalizeRecipesNoticeLinkedDishName\(newMenuItemName\)\s*\|\|\s*t\("recipes\.notice\.linked\.dish\.none"\)/
  );
  assert.doesNotMatch(
    recipesSource,
    /setNotice\(t\("recipes\.notice\.linked", \{\s*ingredient: selectedInventoryItem\.item_name,\s*dish: menuItemName\s*\}\)\)/
  );

  assert.match(catalogSource, /"recipes\.notice\.linked\.ingredient\.none": "Ingredient"/);
  assert.match(catalogSource, /"recipes\.notice\.linked\.ingredient\.none": "Ingrediente"/);
  assert.match(catalogSource, /"recipes\.notice\.linked\.ingredient\.none": "食材"/);
  assert.match(catalogSource, /"recipes\.notice\.linked\.dish\.none": "Dish"/);
  assert.match(catalogSource, /"recipes\.notice\.linked\.dish\.none": "Plato"/);
  assert.match(catalogSource, /"recipes\.notice\.linked\.dish\.none": "菜品"/);

  // Leave Recipes ingredient.itemName row chrome alone (open #1067 / MISE-005XG).
  assert.doesNotMatch(recipesSource, /normalizeRecipesIngredientItemName/);
  assert.match(recipesSource, /\{ingredient\.itemName\}/);

  // Leave recipeName Text / recipes.notice.confirmed alone (open #1080 / MISE-005XT).
  assert.doesNotMatch(recipesSource, /normalizeRecipesDishMenuItemName/);
  assert.match(recipesSource, /<Text style=\{styles\.recipeName\}>\{item\.menu_item_name\}<\/Text>/);
  assert.match(
    recipesSource,
    /setNotice\(t\("recipes\.notice\.confirmed", \{\s*item: item\.menu_item_name\s*\}\)\)/
  );

  // Leave the addRecipeBaselineIngredient write path on Unicode-trimmed draft.
  assert.match(recipesSource, /const menuItemName = newMenuItemName\.trim\(\);/);
  assert.match(recipesSource, /menuItemName,/);

  // Leave POS missing-recipe badge labels on raw menu names.
  assert.match(
    recipesSource,
    /visibleSummary\.posItemsMissingRecipes\.map\(\(itemName\) =>/
  );

  // Leave React list keys on raw menu_item_name (not presentation chrome).
  assert.match(recipesSource, /key=\{item\.menu_item_name\}/);

  const ingredientCode = ingredientIdentitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const dishCode = dishIdentitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(ingredientCode, /presentationRecipesIngredientItemNameIdentity/);
  assert.doesNotMatch(ingredientCode, /presentationRecipesDishMenuItemNameIdentity/);
  assert.doesNotMatch(dishCode, /presentationRecipesIngredientItemNameIdentity/);
  assert.doesNotMatch(dishCode, /presentationRecipesDishMenuItemNameIdentity/);
  assert.doesNotMatch(ingredientIdentitySource, /^import /m);
  assert.doesNotMatch(dishIdentitySource, /^import /m);

  assert.equal(normalizeRecipesNoticeLinkedIngredientName(ingredientName), ingredientName);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(` ${ingredientName} `), ingredientName);
  assert.equal(
    normalizeRecipesNoticeLinkedIngredientName(`Tomate ${ingredientName}`),
    `Tomate ${ingredientName}`
  );
  assert.equal(normalizeRecipesNoticeLinkedDishName(dishName), dishName);
  assert.equal(normalizeRecipesNoticeLinkedDishName(` ${dishName} `), dishName);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`Plato ${dishName}`), `Plato ${dishName}`);
});

test("Unicode padding invents via trim and is soft-nulled for linked notice tokens", () => {
  const paddedIngredient = `${em}${ingredientName}${em}`;
  const nbspIngredient = `${nbsp}${ingredientName}${nbsp}`;
  const paddedDish = `${em}${dishName}${em}`;
  const nbspDish = `${nbsp}${dishName}${nbsp}`;
  const internalEmIngredient = `Roma${em}Tomatoes`;
  const internalNbspDish = `Chicken${nbsp}Bowl`;

  // Inventing proof: Unicode trim would invent the clean notice tokens.
  assert.equal(paddedIngredient.trim(), ingredientName);
  assert.equal(nbspIngredient.trim(), ingredientName);
  assert.equal(paddedDish.trim(), dishName);
  assert.equal(nbspDish.trim(), dishName);
  assert.equal(Boolean(paddedIngredient), true);
  assert.equal(Boolean(paddedDish), true);

  // Live defect: dish notice previously used already-trimmed menuItemName.
  assert.equal(paddedDish.trim() === dishName, true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipesNoticeLinkedIngredientName(paddedIngredient), paddedIngredient);
  assert.equal(canonicalizeRecipesNoticeLinkedIngredientName(paddedIngredient), null);
  assert.equal(canonicalizeRecipesNoticeLinkedIngredientName(nbspIngredient), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(paddedIngredient), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(nbspIngredient), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(paddedIngredient) || "FALLBACK", "FALLBACK");

  assert.equal(asciiTrimRecipesNoticeLinkedDishName(paddedDish), paddedDish);
  assert.equal(canonicalizeRecipesNoticeLinkedDishName(paddedDish), null);
  assert.equal(canonicalizeRecipesNoticeLinkedDishName(nbspDish), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(paddedDish), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(nbspDish), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(paddedDish) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesNoticeLinkedIngredientName(internalEmIngredient), internalEmIngredient);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(internalEmIngredient), internalEmIngredient);
  assert.equal(normalizeRecipesNoticeLinkedDishName(internalNbspDish), internalNbspDish);
});

test("soft empty, controls, and non-strings fail closed for linked notice tokens", () => {
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(undefined), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(null), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(""), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName("   "), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(em), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(123 as unknown as string), null);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(`\u0001${ingredientName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(`${ingredientName}\t`), ingredientName);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(`${ingredientName}\n`), ingredientName);
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(`\t${ingredientName}`), ingredientName);
  assert.equal(
    normalizeRecipesNoticeLinkedIngredientName(`${ingredientName}\u0007`),
    null
  );

  assert.equal(normalizeRecipesNoticeLinkedDishName(undefined), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(null), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(""), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName("   "), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(em), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(123 as unknown as string), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`\u0001${dishName}`), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`${dishName}\t`), dishName);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`${dishName}\n`), dishName);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`\t${dishName}`), dishName);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`${dishName}\u0007`), null);

  // Soft-null falls through to intentional localized none markers.
  assert.equal(
    normalizeRecipesNoticeLinkedIngredientName(em) || "Ingredient",
    "Ingredient"
  );
  assert.equal(normalizeRecipesNoticeLinkedDishName(em) || "Dish", "Dish");
});

test("Unicode-only-space is truthy yet blank-looking for linked notice tokens", () => {
  const onlySpace = em;
  assert.equal(Boolean(onlySpace), true);
  assert.equal(onlySpace.trim(), "");
  assert.notEqual(onlySpace, null);
  assert.notEqual(onlySpace, undefined);
  assert.notEqual(onlySpace, "");
  // Prior always-pass chrome would interpolate blank-looking tokens.
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(onlySpace), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(onlySpace), null);
});

test("NBSP is preserved through linked notice soft-null when not end-padding alone", () => {
  const withInternalNbspIngredient = `Roma${nbsp}Tomatoes`;
  const withInternalNbspDish = `Chicken${nbsp}Bowl`;
  assert.equal(
    normalizeRecipesNoticeLinkedIngredientName(withInternalNbspIngredient),
    withInternalNbspIngredient
  );
  assert.equal(normalizeRecipesNoticeLinkedDishName(withInternalNbspDish), withInternalNbspDish);
  // End-only NBSP padding soft-nulls (inventing gate).
  assert.equal(normalizeRecipesNoticeLinkedIngredientName(`${nbsp}${ingredientName}${nbsp}`), null);
  assert.equal(normalizeRecipesNoticeLinkedDishName(`${nbsp}${dishName}${nbsp}`), null);
});
