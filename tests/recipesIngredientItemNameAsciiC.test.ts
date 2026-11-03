import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesIngredientItemName,
  canonicalizeRecipesIngredientItemName,
  normalizeRecipesIngredientItemName
} from "../services/domain/presentationRecipesIngredientItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRecipesIngredientItemNameIdentity.ts",
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

test("MISE-005XG pins Recipes ingredient.itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XG/);
  assert.match(recipesSource, /MISE-005XG/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesIngredientItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesIngredientItemNameIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesIngredientItemName\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientItemName\(ingredient\.itemName\)\s*\|\|\s*t\("recipes\.row\.itemName\.none"\)/
  );
  assert.doesNotMatch(recipesSource, /\{ingredient\.itemName\}/);
  assert.doesNotMatch(
    recipesSource,
    /ingredient:\s*ingredient\.itemName/
  );

  assert.match(catalogSource, /"recipes\.row\.itemName\.none": "Ingredient"/);
  assert.match(catalogSource, /"recipes\.row\.itemName\.none": "Ingrediente"/);
  assert.match(catalogSource, /"recipes\.row\.itemName\.none": "食材"/);

  // Leave sibling tips and menu_item_name / POS-missing badge paths alone.
  assert.doesNotMatch(recipesSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(recipesSource, /normalizeInventoryDetailItemName/);
  assert.doesNotMatch(recipesSource, /normalizeRecommendationDecisionRowItemName/);
  assert.doesNotMatch(recipesSource, /normalizeDailyReportWasteTopItemName/);
  assert.doesNotMatch(recipesSource, /normalizeLogDeliveryHistoryItemName/);
  assert.doesNotMatch(recipesSource, /normalizeSupplierDraftLine/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecommendationDecisionRowItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDailyReportWasteTopItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationLogDeliveryHistoryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave recipe dish name and POS missing-recipe badges on raw menu names.
  assert.match(recipesSource, /\{item\.menu_item_name\}/);
  assert.match(
    recipesSource,
    /visibleSummary\.posItemsMissingRecipes\.map\(\(itemName\) =>/
  );

  assert.equal(normalizeRecipesIngredientItemName(itemName), itemName);
  assert.equal(normalizeRecipesIngredientItemName(` ${itemName} `), itemName);
  assert.equal(normalizeRecipesIngredientItemName(`Artículo ${itemName}`), `Artículo ${itemName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Recipes ingredient names", () => {
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
  assert.equal(asciiTrimRecipesIngredientItemName(padded), padded);
  assert.equal(canonicalizeRecipesIngredientItemName(padded), null);
  assert.equal(canonicalizeRecipesIngredientItemName(nbspName), null);
  assert.equal(normalizeRecipesIngredientItemName(padded), null);
  assert.equal(normalizeRecipesIngredientItemName(nbspName), null);
  assert.equal(normalizeRecipesIngredientItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesIngredientItemName(internalEm), internalEm);
  assert.equal(normalizeRecipesIngredientItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipesIngredientItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Recipes ingredient names", () => {
  assert.equal(normalizeRecipesIngredientItemName(undefined), null);
  assert.equal(normalizeRecipesIngredientItemName(null), null);
  assert.equal(normalizeRecipesIngredientItemName(""), null);
  assert.equal(normalizeRecipesIngredientItemName("   "), null);
  assert.equal(normalizeRecipesIngredientItemName(123 as unknown as string), null);
  assert.equal(normalizeRecipesIngredientItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesIngredientItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeRecipesIngredientItemName(`${itemName}\u0007`), null);
  assert.equal(normalizeRecipesIngredientItemName(em), null);
});

test("Recipes ingredient bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking ingredient identity
  // on the ingredient name Text and a11y interpolations.
  assert.equal(normalizeRecipesIngredientItemName(""), null);
  assert.equal(normalizeRecipesIngredientItemName(em), null);
  assert.equal(normalizeRecipesIngredientItemName(nbsp), null);
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientItemName\(ingredient\.itemName\)\s*\|\|\s*t\("recipes\.row\.itemName\.none"\)/
  );
});

test("Recipes ingredient-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimRecipesIngredientItemName(padded), padded.trim());
  assert.equal(normalizeRecipesIngredientItemName(padded), null);
  assert.equal(normalizeRecipesIngredientItemName(`\t${itemName}\n`), itemName);
});
