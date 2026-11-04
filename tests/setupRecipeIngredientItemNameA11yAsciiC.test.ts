import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRecipeIngredientItemName,
  canonicalizeSetupRecipeIngredientItemName,
  normalizeSetupRecipeIngredientItemName
} from "../services/domain/presentationSetupRecipeIngredientItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationSetupRecipeIngredientItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/(auth)/setup.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const ingredientName = "Olive oil";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XZ pins Setup recipe quantity/unit a11y ingredient.itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005XZ/);
  assert.match(screenSource, /MISE-005XZ/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRecipeIngredientItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupRecipeIngredientItemNameIdentity"/
  );
  assert.match(screenSource, /normalizeSetupRecipeIngredientItemName\(/);
  assert.match(
    screenSource,
    /normalizeSetupRecipeIngredientItemName\(ingredient\.itemName\)\s*\|\|\s*t\("setup\.fallback\.ingredient"\)/
  );
  assert.doesNotMatch(
    screenSource,
    /quantityAccessibility[\s\S]{0,220}ingredient:\s*ingredient\.itemName\s*\|\|/
  );
  assert.doesNotMatch(
    screenSource,
    /unitAccessibility[\s\S]{0,220}ingredient:\s*ingredient\.itemName\s*\|\|/
  );

  assert.match(catalogSource, /"setup\.fallback\.ingredient": "Ingredient"/);
  assert.match(catalogSource, /"setup\.fallback\.ingredient": "Ingrediente"/);
  assert.match(catalogSource, /"setup\.fallback\.ingredient": "食材"/);

  // Leave TextInput value and recipe.dishName a11y alone.
  assert.match(screenSource, /value=\{ingredient\.itemName\}/);
  assert.match(
    screenSource,
    /recipe:\s*recipe\.dishName\s*\|\|\s*t\("setup\.fallback\.recipe"\)/
  );
  assert.doesNotMatch(identitySource, /presentationRecipesIngredientItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecipesBuilderInventoryItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(
    identitySource,
    /^import .*setupRecipeIngredientItemNameIdentity/m
  );
  assert.match(identitySource, /open #901 \/ MISE-005RO/);

  assert.equal(normalizeSetupRecipeIngredientItemName(ingredientName), ingredientName);
  assert.equal(
    normalizeSetupRecipeIngredientItemName(` ${ingredientName} `),
    ingredientName
  );
  assert.equal(
    normalizeSetupRecipeIngredientItemName(`Case-${ingredientName}`),
    `Case-${ingredientName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Setup recipe ingredient a11y names", () => {
  const padded = `${em}${ingredientName}${em}`;
  const nbspName = `${nbsp}${ingredientName}${nbsp}`;
  const internalEm = `Olive${em}oil`;
  const internalNbsp = `Olive${nbsp}oil`;

  // Inventing proof: Unicode trim would invent the clean ingredient name.
  assert.equal(padded.trim(), ingredientName);
  assert.equal(nbspName.trim(), ingredientName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupRecipeIngredientItemName(padded), padded);
  assert.equal(canonicalizeSetupRecipeIngredientItemName(padded), null);
  assert.equal(canonicalizeSetupRecipeIngredientItemName(nbspName), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(padded), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(nbspName), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupRecipeIngredientItemName(internalEm), internalEm);
  assert.equal(normalizeSetupRecipeIngredientItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeSetupRecipeIngredientItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Setup recipe ingredient a11y names", () => {
  assert.equal(normalizeSetupRecipeIngredientItemName(undefined), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(null), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(""), null);
  assert.equal(normalizeSetupRecipeIngredientItemName("   "), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(123 as unknown as string), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(`\u0001${ingredientName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSetupRecipeIngredientItemName(`${ingredientName}\t`), ingredientName);
  assert.equal(normalizeSetupRecipeIngredientItemName(`${ingredientName}\u0007`), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(em), null);
});

test("Setup recipe ingredient a11y bypass proof: empty and Unicode-only-space names soft-null to localized fallback", () => {
  // Prior raw `||` path let truthy Unicode-only space bypass setup.fallback.ingredient.
  assert.equal(normalizeSetupRecipeIngredientItemName(""), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(em), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName || "", "");
  assert.equal(unicodeOnlyName || "", em);
  assert.notEqual(unicodeOnlyName || "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.equal(Boolean(unicodeOnlyName || "FALLBACK"), true);
  assert.equal(unicodeOnlyName || "FALLBACK", em);
  assert.match(
    screenSource,
    /normalizeSetupRecipeIngredientItemName\(ingredient\.itemName\)\s*\|\|\s*t\("setup\.fallback\.ingredient"\)/
  );
});

test("Setup recipe ingredient a11y itemName identity refuses Unicode inventing equality", () => {
  const padded = `${em}${ingredientName}${em}`;
  assert.notEqual(asciiTrimSetupRecipeIngredientItemName(padded), padded.trim());
  assert.equal(normalizeSetupRecipeIngredientItemName(padded), null);
  assert.equal(normalizeSetupRecipeIngredientItemName(`\t${ingredientName}\n`), ingredientName);
});
