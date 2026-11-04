import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRecipeDishName,
  canonicalizeSetupRecipeDishName,
  normalizeSetupRecipeDishName
} from "../services/domain/presentationSetupRecipeDishNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSetupRecipeDishNameIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/(auth)/setup.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const dishName = "Margherita Pizza";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005YA pins Setup recipe remove/a11y dishName to ASCII C", () => {
  assert.match(identitySource, /MISE-005YA/);
  assert.match(screenSource, /MISE-005YA/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRecipeDishName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupRecipeDishNameIdentity"/
  );
  assert.match(screenSource, /normalizeSetupRecipeDishName\(/);
  assert.match(
    screenSource,
    /normalizeSetupRecipeDishName\(recipe\.dishName\)\s*\|\|\s*t\("setup\.fallback\.recipe"\)/
  );
  assert.doesNotMatch(
    screenSource,
    /setup\.remove\.recipe[\s\S]{0,220}recipe:\s*recipe\.dishName\s*\|\|/
  );
  assert.doesNotMatch(
    screenSource,
    /recipeIngredientAccessibility[\s\S]{0,220}recipe:\s*recipe\.dishName\s*\|\|/
  );
  assert.doesNotMatch(
    screenSource,
    /addIngredientAccessibility[\s\S]{0,220}recipe:\s*recipe\.dishName\s*\|\|/
  );

  assert.match(catalogSource, /"setup\.fallback\.recipe": "recipe"/);
  assert.match(catalogSource, /"setup\.fallback\.recipe": "receta"/);
  assert.match(catalogSource, /"setup\.fallback\.recipe": "配方"/);

  // Leave TextInput value and quantity/unit ingredient.itemName a11y alone.
  assert.match(screenSource, /value=\{recipe\.dishName\}/);
  assert.match(
    screenSource,
    /ingredient:\s*ingredient\.itemName\s*\|\|\s*t\("setup\.fallback\.ingredient"\)/
  );
  assert.doesNotMatch(identitySource, /presentationSetupRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.doesNotMatch(
    identitySource,
    /^import .*setupRecipeDishNameIdentity/m
  );
  assert.doesNotMatch(
    identitySource,
    /^import .*setupDraftsRecipeDishNameIdentity/m
  );
  assert.match(identitySource, /open #862 \/ MISE-005QB/);
  assert.match(identitySource, /open #900 \/ MISE-005RN/);

  assert.equal(normalizeSetupRecipeDishName(dishName), dishName);
  assert.equal(normalizeSetupRecipeDishName(` ${dishName} `), dishName);
  assert.equal(normalizeSetupRecipeDishName(`Case-${dishName}`), `Case-${dishName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Setup recipe dishName a11y", () => {
  const padded = `${em}${dishName}${em}`;
  const nbspName = `${nbsp}${dishName}${nbsp}`;
  const internalEm = `Margherita${em}Pizza`;
  const internalNbsp = `Margherita${nbsp}Pizza`;

  // Inventing proof: Unicode trim would invent the clean dish name.
  assert.equal(padded.trim(), dishName);
  assert.equal(nbspName.trim(), dishName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupRecipeDishName(padded), padded);
  assert.equal(canonicalizeSetupRecipeDishName(padded), null);
  assert.equal(canonicalizeSetupRecipeDishName(nbspName), null);
  assert.equal(normalizeSetupRecipeDishName(padded), null);
  assert.equal(normalizeSetupRecipeDishName(nbspName), null);
  assert.equal(normalizeSetupRecipeDishName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupRecipeDishName(internalEm), internalEm);
  assert.equal(normalizeSetupRecipeDishName(internalNbsp), internalNbsp);
  assert.equal(normalizeSetupRecipeDishName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Setup recipe dishName a11y", () => {
  assert.equal(normalizeSetupRecipeDishName(undefined), null);
  assert.equal(normalizeSetupRecipeDishName(null), null);
  assert.equal(normalizeSetupRecipeDishName(""), null);
  assert.equal(normalizeSetupRecipeDishName("   "), null);
  assert.equal(normalizeSetupRecipeDishName(123 as unknown as string), null);
  assert.equal(normalizeSetupRecipeDishName(`\u0001${dishName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSetupRecipeDishName(`${dishName}\t`), dishName);
  assert.equal(normalizeSetupRecipeDishName(`${dishName}\u0007`), null);
  assert.equal(normalizeSetupRecipeDishName(em), null);
});

test("Setup recipe dishName a11y bypass proof: empty and Unicode-only-space names soft-null to localized fallback", () => {
  // Prior raw `||` path let truthy Unicode-only space bypass setup.fallback.recipe.
  assert.equal(normalizeSetupRecipeDishName(""), null);
  assert.equal(normalizeSetupRecipeDishName(em), null);
  assert.equal(normalizeSetupRecipeDishName(nbsp), null);
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
    /normalizeSetupRecipeDishName\(recipe\.dishName\)\s*\|\|\s*t\("setup\.fallback\.recipe"\)/
  );
});

test("Setup recipe dishName a11y identity refuses Unicode inventing equality", () => {
  const padded = `${em}${dishName}${em}`;
  assert.notEqual(asciiTrimSetupRecipeDishName(padded), padded.trim());
  assert.equal(normalizeSetupRecipeDishName(padded), null);
  assert.equal(normalizeSetupRecipeDishName(`\t${dishName}\n`), dishName);
});
