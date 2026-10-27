import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupDraftsRecipeIngredientQuantityText,
  canonicalizeSetupDraftsRecipeIngredientQuantityText,
  normalizeSetupDraftsRecipeIngredientQuantityText
} from "../services/domain/setupDraftsRecipeIngredientQuantityIdentity";
import {
  buildSetupDataHealthSummary,
  buildSetupDraftReadiness,
  buildSetupPersistencePreview,
  recipeDraftsToBaselineText
} from "../services/domain/setupDrafts";

const identitySource = readFileSync(
  new URL("../services/domain/setupDraftsRecipeIngredientQuantityIdentity.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");

const itemName = "Tomato";
const unit = "oz";
const quantity = "12";
const em = "\u2003";
const nbsp = "\u00a0";

function recipeWithQuantity(quantityText: string) {
  return [
    {
      id: "recipe-1",
      dishName: "Margherita",
      ingredients: [
        {
          id: "ing-1",
          itemName,
          quantity: quantityText,
          unit
        }
      ]
    }
  ];
}

test("MISE-005RK pins setup-drafts recipe ingredient quantity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RK/);
  assert.match(setupDraftsSource, /MISE-005RK/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupDraftsRecipeIngredientQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(setupDraftsSource, /from "\.\/setupDraftsRecipeIngredientQuantityIdentity"/);
  assert.match(
    setupDraftsSource,
    /normalizeSetupDraftsRecipeIngredientQuantityText\(ingredient\.quantity\)/
  );
  assert.doesNotMatch(setupDraftsSource, /const quantity = ingredient\.quantity\.trim\(\);/);
  assert.doesNotMatch(
    setupDraftsSource,
    /ingredient\.itemName\.trim\(\) && ingredient\.quantity\.trim\(\) && ingredient\.unit\.trim\(\)/
  );

  // Leave setup.tsx locale parseNumber recipe quantity path on open #896.
  assert.match(
    setupSource,
    /isBoundedSetupNumber\(ingredient\.quantity, Number\.EPSILON, operatingLimits\.recipeQuantityPerSale, parseNumber\)/
  );
  assert.match(setupSource, /quantity: normalizeDraftNumber\(ingredient\.quantity, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupRecipeIngredientQuantityText\(/);
  assert.doesNotMatch(setupSource, /setupRecipeIngredientQuantityIdentity/);
  assert.doesNotMatch(setupSource, /setupDraftsRecipeIngredientQuantityIdentity/);

  // Leave setup inventory on-hand quantity emptiness on the prior bare contract
  // (open #895) inside setupDrafts readiness / health filters.
  assert.match(setupDraftsSource, /item\.quantity\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryQuantityIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupInventoryParLevelIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupRecipeIngredientQuantityIdentity/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /prepareInventoryDetailSettingsQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryDetailQuantityText/);
  assert.doesNotMatch(identitySource, /prepareLogDeliveryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareOrdersRecommendationQuantityText/);
  assert.doesNotMatch(identitySource, /prepareInventoryCountQuantityText/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupPosItemLabelIdentity["']/);
});

test("ASCII C prep keeps ordinary setup-drafts recipe ingredient quantities stable", () => {
  assert.equal(asciiTrimSetupDraftsRecipeIngredientQuantityText(`  ${quantity}  `), quantity);
  assert.equal(asciiTrimSetupDraftsRecipeIngredientQuantityText(`\t${quantity}\n`), quantity);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientQuantityText(`  ${quantity}  `), quantity);
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(`  ${quantity}  `), quantity);
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText("0.5"), "0.5");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText("1,234.5"), "1,234.5");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(null), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(undefined), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(""), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText("   "), "");

  const baseline = recipeDraftsToBaselineText(recipeWithQuantity(`  ${quantity}  `));
  assert.equal(baseline, `Margherita: ${itemName} ${quantity} ${unit}`);

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithQuantity(`\t${quantity}\n`),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, true);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithQuantity(`  ${quantity}  `),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 1);
});

test("NBSP and em-space padding cannot invent setup-drafts recipe ingredient quantities", () => {
  const padded = `${em}${quantity}${em}`;
  const nbspPadded = `${nbsp}${quantity}${nbsp}`;
  const unicodeOnly = em;

  // Inventing proof: Unicode trim would invent the clean quantity / empty skip.
  assert.equal(padded.trim(), quantity);
  assert.equal(nbspPadded.trim(), quantity);
  assert.equal(unicodeOnly.trim(), "");

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupDraftsRecipeIngredientQuantityText(padded), padded);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientQuantityText(padded), null);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientQuantityText(nbspPadded), null);
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(padded), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(nbspPadded), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(unicodeOnly), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(`${quantity}\u0007`), "");

  // Baseline must not invent a clean quantity token into the durable string.
  assert.equal(recipeDraftsToBaselineText(recipeWithQuantity(padded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithQuantity(nbspPadded)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithQuantity(unicodeOnly)), "");
  assert.equal(
    recipeDraftsToBaselineText(recipeWithQuantity(quantity)),
    `Margherita: ${itemName} ${quantity} ${unit}`
  );

  const readiness = buildSetupDraftReadiness({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithQuantity(padded),
    emailConnected: false
  });
  assert.equal(readiness.recipesReady, false);

  const preview = buildSetupPersistencePreview({
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithQuantity(nbspPadded),
    attachments: []
  });
  assert.equal(preview.recipeMappings, 0);

  const health = buildSetupDataHealthSummary({
    restaurantName: "Demo Kitchen",
    cuisineType: "Italian",
    inventoryItems: [],
    suppliers: [{ id: "s1", name: "Sysco", email: "orders@example.com" }],
    recipes: recipeWithQuantity(padded),
    posSales: [],
    emailConnected: false
  });
  assert.equal(health.signals.find((signal) => signal.id === "recipes")?.value, "0 dishes");
});

test("control characters cannot invent setup-drafts recipe ingredient quantities", () => {
  const withNull = `${quantity}\u0000`;
  const withBell = `\u0007${quantity}`;

  assert.equal(canonicalizeSetupDraftsRecipeIngredientQuantityText(withNull), null);
  assert.equal(canonicalizeSetupDraftsRecipeIngredientQuantityText(withBell), null);
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(withNull), "");
  assert.equal(normalizeSetupDraftsRecipeIngredientQuantityText(withBell), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithQuantity(withNull)), "");
  assert.equal(recipeDraftsToBaselineText(recipeWithQuantity(withBell)), "");
});
