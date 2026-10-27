import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsRecipeIngredientItemNameText,
  canonicalizeSetupDraftsRecipeIngredientItemNameText,
  normalizeSetupDraftsRecipeIngredientItemNameText
} from "../services/domain/setupDraftsRecipeIngredientItemNameIdentity";
import {
  buildSetupDataHealthSummary,
  buildSetupDraftReadiness,
  buildSetupPersistencePreview,
  recipeDraftsToBaselineText
} from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsRecipeIngredientItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const applicationSetupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const itemName = "Tomato";
const unit = "oz";
const quantity = "12";
const em = "\u2003";
const nbsp = "\u00a0";

function recipeWithItemName(itemNameText: string) {
  return [
    {
      id: "recipe-1",
      dishName: "Margherita",
      ingredients: [
        {
          id: "ing-1",
          itemName: itemNameText,
          quantity,
          unit
        }
      ]
    }
  ];
}

test("MISE-005RL pins setup-drafts recipe ingredient itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005RL/);
  assert.match(setupDraftsSource, /MISE-005RL/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsRecipeIngredientItemNameText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(setupDraftsSource, /from "\.\/setupDraftsRecipeIngredientItemNameIdentity"/);
  assert.match(
    setupDraftsSource,
    /normalizeSetupDraftsRecipeIngredientItemNameText\(ingredient\.itemName\)/
  );
  assert.doesNotMatch(setupDraftsSource, /const itemName = ingredient\.itemName\.trim\(\);/);
  assert.doesNotMatch(
    setupDraftsSource,
    /ingredient\.itemName\.trim\(\) && ingredient\.quantity\.trim\(\) && ingredient\.unit\.trim\(\)/
  );

  // Leave setup-drafts recipe ingredient quantity on the prior bare contract
  // (open #897) until that tip owns it.
  assert.match(setupDraftsSource, /const quantity = ingredient\.quantity\.trim\(\);/);
  assert.match(setupDraftsSource, /ingredient\.quantity\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeIngredientQuantityText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsRecipeIngredientQuantityIdentity/);

  // Leave setup-drafts unit and dishName on the prior bare Unicode trim contract.
  assert.match(setupDraftsSource, /const unit = ingredient\.unit\.trim\(\);/);
  assert.match(setupDraftsSource, /const dishName = recipe\.dishName\.trim\(\);/);

  // Leave setup.tsx recipe ingredient itemName validation alone.
  assert.match(setupSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(setupSource, /prepareSetupDraftsRecipeIngredientItemNameText\(/);
  assert.doesNotMatch(setupSource, /setupDraftsRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(setupSource, /normalizeSetupDraftsRecipeIngredientItemNameText\(/);

  // Leave application setup ingredient.itemName.trim lookup / #679 key path alone.
  assert.match(applicationSetupSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(applicationSetupSource, /setupDraftsRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(applicationSetupSource, /normalizeSetupDraftsRecipeIngredientItemNameText\(/);

  // Leave sibling quantity / inventory tips alone inside setupDrafts.
  assert.match(setupDraftsSource, /item\.quantity\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryQuantityIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryParLevelIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupRecipeIngredientQuantityIdentity/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeDishNameText/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeDishNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryUnitIdentity["']/);
});

test("ASCII C prep keeps ordinary setup-drafts recipe ingredient item names stable", () => {
  assert.equal(asciiTrimSetupDraftsRecipeIngredientItemNameText(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimSetupDraftsRecipeIngredientItemNameText(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientItemNameText(`  ${itemName}  `), itemName);
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(`  ${itemName}  `), itemName);
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText("Mozzarella"), "Mozzarella");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText("San Marzano"), "San Marzano");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(null), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(undefined), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(""), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText("   "), "");

  const baseline = recipeDraftsToBaselineText(recipeWithItemName(`  ${itemName}  `));
  assert.equal(baseline, `Margherita: ${itemName} ${quantity} ${unit}`);

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithItemName(`\t${itemName}\n`),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, true);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithItemName(`  ${itemName}  `),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 1);
});

test("NBSP and em-space padding cannot invent setup-drafts recipe ingredient item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspPadded = `${nbsp}${itemName}${nbsp}`;
  const unicodeOnly = em;

  // Inventing proof: Unicode trim would invent the clean item name / empty skip.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspPadded.trim(), itemName);
  assert.equal(unicodeOnly.trim(), "");

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupDraftsRecipeIngredientItemNameText(padded), padded);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientItemNameText(padded), null);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientItemNameText(nbspPadded), null);
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(padded), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(nbspPadded), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(unicodeOnly), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(`${itemName}\u0007`), "");

  // Baseline must not invent a clean itemName token into the durable string.
  assert.equal(recipeDraftsToBaselineText(recipeWithItemName(padded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithItemName(nbspPadded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithItemName(unicodeOnly)), "");
  assert.equal(
    recipeDraftsToBaselineText(recipeWithItemName(itemName)),
    `Margherita: ${itemName} ${quantity} ${unit}`
  );

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithItemName(padded),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, false);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithItemName(nbspPadded),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 0);

  const health = buildSetupDataHealthSummary({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithItemName(padded),
    posSales: [],
    emailConnected: false
  });
  assert.equal(health.signals.find((signal) => signal.id === "recipes")?.value, "0 dishes");
});

test("control characters cannot invent setup-drafts recipe ingredient item names", () => {
  const withNull = `${itemName}\u0000`;
  const withBell = `\u0007${itemName}`;

  assert.equal(canonicalizeSetupDraftsRecipeIngredientItemNameText(withNull), null);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientItemNameText(withBell), null);
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(withNull), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientItemNameText(withBell), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithItemName(withNull)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithItemName(withBell)), "");
});
