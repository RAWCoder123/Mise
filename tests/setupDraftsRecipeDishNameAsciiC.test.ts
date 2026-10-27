import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsRecipeDishNameText,
  canonicalizeSetupDraftsRecipeDishNameText,
  normalizeSetupDraftsRecipeDishNameText
} from "../services/domain/setupDraftsRecipeDishNameIdentity";
import {
  buildSetupDataHealthSummary,
  buildSetupDraftReadiness,
  buildSetupPersistencePreview,
  recipeDraftsToBaselineText
} from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsRecipeDishNameIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);
const applicationSetupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");

const dishName = "Margherita";
const itemName = "Tomato";
const unit = "oz";
const quantity = "12";
const em = "\u2003";
const nbsp = "\u00a0";

function recipeWithDishName(dishNameText: string) {
  return [
    {
      id: "recipe-1",
      dishName: dishNameText,
      ingredients: [
        {
          id: "ing-1",
          itemName,
          quantity,
          unit
        }
      ]
    }
  ];
}

test("MISE-005RN pins setup-drafts recipe dishName to ASCII C", () => {
  assert.match(identitySource, /MISE-005RN/);
  assert.match(setupDraftsSource, /MISE-005RN/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsRecipeDishNameText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(setupDraftsSource, /from "\.\/setupDraftsRecipeDishNameIdentity"/);
  assert.match(
    setupDraftsSource,
    /normalizeSetupDraftsRecipeDishNameText\(recipe\.dishName\)/
  );
  assert.doesNotMatch(setupDraftsSource, /const dishName = recipe\.dishName\.trim\(\);/);
  assert.doesNotMatch(setupDraftsSource, /recipe\.dishName\.trim\(\)/);

  // Leave setup-drafts recipe ingredient itemName on the prior bare contract
  // (open #898) until that tip owns it.
  assert.match(setupDraftsSource, /const itemName = ingredient\.itemName\.trim\(\);/);
  assert.match(setupDraftsSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeIngredientItemNameText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsRecipeIngredientItemNameIdentity/);

  // Leave setup-drafts recipe ingredient quantity on the prior bare contract
  // (open #897) until that tip owns it.
  assert.match(setupDraftsSource, /const quantity = ingredient\.quantity\.trim\(\);/);
  assert.match(setupDraftsSource, /ingredient\.quantity\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeIngredientQuantityText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsRecipeIngredientQuantityIdentity/);

  // Leave setup-drafts recipe ingredient unit on the prior bare contract
  // (open #899) until that tip owns it.
  assert.match(setupDraftsSource, /const unit = ingredient\.unit\.trim\(\);/);
  assert.match(setupDraftsSource, /ingredient\.unit\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeIngredientUnitText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsRecipeIngredientUnitIdentity/);

  // Leave application setup recipe dishName (#862) alone — do not share modules.
  assert.doesNotMatch(setupDraftsSource, /setupRecipeDishNameIdentity/);
  assert.doesNotMatch(setupDraftsSource, /normalizeCanonicalSetupRecipeDishName\(/);
  assert.doesNotMatch(setupDraftsSource, /prepareSetupRecipeDishNameText\(/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeDishNameIdentity["']/);
  assert.doesNotMatch(identitySource, /normalizeCanonicalSetupRecipeDishName/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeDishNameText/);
  assert.doesNotMatch(identitySource, /canonicalizeSetupRecipeDishName\b/);
  assert.doesNotMatch(applicationSetupSource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(applicationSetupSource, /normalizeSetupDraftsRecipeDishNameText\(/);

  // Leave setup.tsx dishName paths alone (application tip #862 owns save).
  assert.doesNotMatch(setupSource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(setupSource, /normalizeSetupDraftsRecipeDishNameText\(/);

  // Leave sibling inventory tips alone inside setupDrafts.
  assert.match(setupDraftsSource, /item\.quantity\.trim\(\)/);
  assert.match(setupDraftsSource, /item\.unit\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupInventoryUnitText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryQuantityIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryParLevelIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryUnitIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupRecipeIngredientQuantityIdentity/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientUnitText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientUnitText/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryUnitText/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientUnitIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryUnitIdentity["']/);
});

test("ASCII C prep keeps ordinary setup-drafts recipe dishNames stable", () => {
  assert.equal(asciiTrimSetupDraftsRecipeDishNameText(`  ${dishName}  `), dishName);
  assert.equal(asciiTrimSetupDraftsRecipeDishNameText(`\t${dishName}\n`), dishName);
  assert.equal(canonicalizeSetupDraftsRecipeDishNameText(`  ${dishName}  `), dishName);
  assert.equal(normalizeSetupDraftsRecipeDishNameText(`  ${dishName}  `), dishName);
  assert.equal(normalizeSetupDraftsRecipeDishNameText("Pasta Primavera"), "Pasta Primavera");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(null), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(undefined), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(""), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText("   "), "");

  const baseline = recipeDraftsToBaselineText(recipeWithDishName(`  ${dishName}  `));
  assert.equal(baseline, `${dishName}: ${itemName} ${quantity} ${unit}`);

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithDishName(`\t${dishName}\n`),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, true);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithDishName(`  ${dishName}  `),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 1);
});

test("NBSP and em-space padding cannot invent setup-drafts recipe dishNames", () => {
  const padded = `${em}${dishName}${em}`;
  const nbspPadded = `${nbsp}${dishName}${nbsp}`;
  const unicodeOnly = em;

  // Inventing proof: Unicode trim would invent the clean dish name / empty skip.
  assert.equal(padded.trim(), dishName);
  assert.equal(nbspPadded.trim(), dishName);
  assert.equal(unicodeOnly.trim(), "");

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupDraftsRecipeDishNameText(padded), padded);
  assert.equal(canonicalizeSetupDraftsRecipeDishNameText(padded), null);
  assert.equal(canonicalizeSetupDraftsRecipeDishNameText(nbspPadded), null);
  assert.equal(normalizeSetupDraftsRecipeDishNameText(padded), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(nbspPadded), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(unicodeOnly), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(`${dishName}\u0007`), "");

  // Baseline must not invent a clean dish token into the durable string.
  assert.equal(recipeDraftsToBaselineText(recipeWithDishName(padded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithDishName(nbspPadded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithDishName(unicodeOnly)), "");
  assert.equal(
    recipeDraftsToBaselineText(recipeWithDishName(dishName)),
    `${dishName}: ${itemName} ${quantity} ${unit}`
  );

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithDishName(padded),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, false);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithDishName(nbspPadded),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 0);

  const health = buildSetupDataHealthSummary({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithDishName(padded),
    posSales: [],
    emailConnected: false
  });
  assert.equal(health.signals.find((signal) => signal.id === "recipes")?.value, "0 dishes");
});

test("control characters cannot invent setup-drafts recipe dishNames", () => {
  const withNull = `${dishName}\u0000`;
  const withBell = `\u0007${dishName}`;

  assert.equal(canonicalizeSetupDraftsRecipeDishNameText(withNull), null);
  assert.equal(canonicalizeSetupDraftsRecipeDishNameText(withBell), null);
  assert.equal(normalizeSetupDraftsRecipeDishNameText(withNull), "");
  assert.equal(normalizeSetupDraftsRecipeDishNameText(withBell), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithDishName(withNull)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithDishName(withBell)), "");
});
