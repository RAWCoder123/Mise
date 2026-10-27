import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsRecipeIngredientUnitText,
  canonicalizeSetupDraftsRecipeIngredientUnitText,
  normalizeSetupDraftsRecipeIngredientUnitText
} from "../services/domain/setupDraftsRecipeIngredientUnitIdentity";
import {
  buildSetupDataHealthSummary,
  buildSetupDraftReadiness,
  buildSetupPersistencePreview,
  recipeDraftsToBaselineText
} from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsRecipeIngredientUnitIdentity.ts", import.meta.url),
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

function recipeWithUnit(unitText: string) {
  return [
    {
      id: "recipe-1",
      dishName: "Margherita",
      ingredients: [
        {
          id: "ing-1",
          itemName,
          quantity,
          unit: unitText
        }
      ]
    }
  ];
}

test("MISE-005RM pins setup-drafts recipe ingredient unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005RM/);
  assert.match(setupDraftsSource, /MISE-005RM/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsRecipeIngredientUnitText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(setupDraftsSource, /from "\.\/setupDraftsRecipeIngredientUnitIdentity"/);
  assert.match(
    setupDraftsSource,
    /normalizeSetupDraftsRecipeIngredientUnitText\(ingredient\.unit\)/
  );
  assert.doesNotMatch(setupDraftsSource, /const unit = ingredient\.unit\.trim\(\);/);
  assert.doesNotMatch(
    setupDraftsSource,
    /ingredient\.itemName\.trim\(\) && ingredient\.quantity\.trim\(\) && ingredient\.unit\.trim\(\)/
  );

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

  // Leave setup-drafts dishName on the prior bare Unicode trim contract.
  assert.match(setupDraftsSource, /const dishName = recipe\.dishName\.trim\(\);/);

  // Leave inventory item.unit.trim on the prior bare contract (#861 owns setup
  // inventory units, not setup-drafts recipe ingredient units).
  assert.match(setupDraftsSource, /item\.unit\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupInventoryUnitText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryUnitIdentity/);

  // Leave setup.tsx recipe ingredient unit validation alone.
  assert.match(setupSource, /ingredient\.unit\.trim\(\)/);
  assert.doesNotMatch(setupSource, /prepareSetupDraftsRecipeIngredientUnitText\(/);
  assert.doesNotMatch(setupSource, /setupDraftsRecipeIngredientUnitIdentity/);
  assert.doesNotMatch(setupSource, /normalizeSetupDraftsRecipeIngredientUnitText\(/);

  // Leave application setup ingredient.unit.trim || "unit" alone.
  assert.match(applicationSetupSource, /ingredient\.unit\.trim\(\)/);
  assert.doesNotMatch(applicationSetupSource, /setupDraftsRecipeIngredientUnitIdentity/);
  assert.doesNotMatch(applicationSetupSource, /normalizeSetupDraftsRecipeIngredientUnitText\(/);

  // Leave sibling quantity / inventory tips alone inside setupDrafts.
  assert.match(setupDraftsSource, /item\.quantity\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryQuantityIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryParLevelIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupRecipeIngredientQuantityIdentity/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /prepareSetupRecipeDishNameText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryUnitText/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeDishNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryUnitIdentity["']/);
});

test("ASCII C prep keeps ordinary setup-drafts recipe ingredient units stable", () => {
  assert.equal(asciiTrimSetupDraftsRecipeIngredientUnitText(`  ${unit}  `), unit);
  assert.equal(asciiTrimSetupDraftsRecipeIngredientUnitText(`\t${unit}\n`), unit);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientUnitText(`  ${unit}  `), unit);
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(`  ${unit}  `), unit);
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText("lb"), "lb");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText("each"), "each");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(null), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(undefined), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(""), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText("   "), "");

  const baseline = recipeDraftsToBaselineText(recipeWithUnit(`  ${unit}  `));
  assert.equal(baseline, `Margherita: ${itemName} ${quantity} ${unit}`);

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithUnit(`\t${unit}\n`),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, true);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithUnit(`  ${unit}  `),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 1);
});

test("NBSP and em-space padding cannot invent setup-drafts recipe ingredient units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspPadded = `${nbsp}${unit}${nbsp}`;
  const unicodeOnly = em;

  // Inventing proof: Unicode trim would invent the clean unit / empty skip.
  assert.equal(padded.trim(), unit);
  assert.equal(nbspPadded.trim(), unit);
  assert.equal(unicodeOnly.trim(), "");

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupDraftsRecipeIngredientUnitText(padded), padded);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientUnitText(padded), null);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientUnitText(nbspPadded), null);
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(padded), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(nbspPadded), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(unicodeOnly), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(`${unit}\u0007`), "");

  // Baseline must not invent a clean unit token into the durable string.
  assert.equal(recipeDraftsToBaselineText(recipeWithUnit(padded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithUnit(nbspPadded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithUnit(unicodeOnly)), "");
  assert.equal(
    recipeDraftsToBaselineText(recipeWithUnit(unit)),
    `Margherita: ${itemName} ${quantity} ${unit}`
  );

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithUnit(padded),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, false);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithUnit(nbspPadded),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 0);

  const health = buildSetupDataHealthSummary({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithUnit(padded),
    posSales: [],
    emailConnected: false
  });
  assert.equal(health.signals.find((signal) => signal.id === "recipes")?.value, "0 dishes");
});

test("control characters cannot invent setup-drafts recipe ingredient units", () => {
  const withNull = `${unit}\u0000`;
  const withBell = `\u0007${unit}`;

  assert.equal(canonicalizeSetupDraftsRecipeIngredientUnitText(withNull), null);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientUnitText(withBell), null);
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(withNull), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientUnitText(withBell), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithUnit(withNull)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithUnit(withBell)), "");
});
