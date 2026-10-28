import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesSettingsQuantityText,
  canonicalizeRecipesSettingsQuantityText,
  prepareRecipesSettingsQuantityText
} from "../services/domain/recipesSettingsQuantityIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/recipesSettingsQuantityIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(new URL("../app/settings/recipes.tsx", import.meta.url), "utf8");
const ordersSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const nameIdentityPath = new URL(
  "../services/domain/recipeSettingsIdentity.ts",
  import.meta.url
);

test("MISE-005SF pins Recipes-settings quantity draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005SF/);
  assert.match(screenSource, /MISE-005SF/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesSettingsQuantityText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/recipesSettingsQuantityIdentity"/
  );
  assert.match(screenSource, /prepareRecipesSettingsQuantityText\(/);
  assert.match(screenSource, /parseNumber\(prepared\.text\)/);
  assert.doesNotMatch(screenSource, /requireRecipeBaselineQuantity\(parseNumber\(quantity\)\)/);
  assert.doesNotMatch(screenSource, /requireRecipeBaselineQuantity\(parseNumber\(newQuantity\)\)/);
  assert.doesNotMatch(screenSource, /requireRecipeBaselineQuantity\(parseNumber\(draftValue\)\)/);

  // Leave Orders review quantity and setup.tsx quantity drafts on their
  // existing contracts (out of scope for this tip).
  assert.match(ordersSource, /quantities\[recommendation\.id\]\?\.trim\(\)/);
  assert.match(setupSource, /normalizeDraftNumber/);

  // Do not rewrite sibling name tip #689 through this module.
  assert.doesNotMatch(identitySource, /normalizeRecipeSettings/);
  assert.doesNotMatch(identitySource, /recipeSettingsIdentity/);
  assert.doesNotMatch(identitySource, /from ["']\.\/recipeSettingsIdentity["']/);
  assert.doesNotMatch(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/recipeSettingsIdentity"/
  );
  // Name identity module stays a separate open tip (#689); do not create it here.
  try {
    readFileSync(nameIdentityPath, "utf8");
    assert.fail("recipeSettingsIdentity.ts must remain owned by open #689");
  } catch (error) {
    assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
  }
});

test("ASCII trim keeps ordinary Recipes-settings quantity drafts stable", () => {
  assert.equal(asciiTrimRecipesSettingsQuantityText("  12  "), "12");
  assert.deepEqual(canonicalizeRecipesSettingsQuantityText("\t12\n"), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareRecipesSettingsQuantityText("  12  "), {
    status: "ok",
    text: "12"
  });
  assert.deepEqual(prepareRecipesSettingsQuantityText("0.5"), { status: "ok", text: "0.5" });
  assert.deepEqual(prepareRecipesSettingsQuantityText("1,234.5"), {
    status: "ok",
    text: "1,234.5"
  });
  assert.deepEqual(prepareRecipesSettingsQuantityText("1.234,5"), {
    status: "ok",
    text: "1.234,5"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty.
  assert.deepEqual(prepareRecipesSettingsQuantityText("   "), { status: "empty" });
  assert.deepEqual(prepareRecipesSettingsQuantityText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareRecipesSettingsQuantityText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean Recipes-settings quantity", () => {
  const amount = "12";
  const nbspAmount = `\u00a0${amount}\u00a0`;
  const emAmount = `\u2003${amount}\u2003`;

  // Live inventing proof on Unicode trim (what parseLocalizedNumber used before
  // this tip gated the draft).
  assert.equal(nbspAmount.trim(), amount);
  assert.equal(emAmount.trim(), amount);

  assert.deepEqual(canonicalizeRecipesSettingsQuantityText(nbspAmount), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeRecipesSettingsQuantityText(emAmount), {
    status: "invalid"
  });
  assert.deepEqual(prepareRecipesSettingsQuantityText(nbspAmount), { status: "invalid" });
  assert.deepEqual(prepareRecipesSettingsQuantityText(emAmount), { status: "invalid" });

  // Soft empty Unicode-only padding falls through like prior emptiness →
  // quantity error, and must not invent an ok draft from a padded amount.
  assert.deepEqual(prepareRecipesSettingsQuantityText("\u2003\u2003"), { status: "empty" });
  assert.deepEqual(prepareRecipesSettingsQuantityText("\u00a0\u00a0"), { status: "empty" });
  assert.notDeepEqual(prepareRecipesSettingsQuantityText(emAmount), { status: "empty" });
  assert.notDeepEqual(prepareRecipesSettingsQuantityText(emAmount), {
    status: "ok",
    text: amount
  });
});

test("ASCII controls and non-string quantity drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeRecipesSettingsQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(canonicalizeRecipesSettingsQuantityText("12\r3"), { status: "invalid" });
  assert.deepEqual(canonicalizeRecipesSettingsQuantityText("12\x013"), { status: "invalid" });
  assert.deepEqual(canonicalizeRecipesSettingsQuantityText("12\x7f3"), { status: "invalid" });
  assert.deepEqual(prepareRecipesSettingsQuantityText("12\n3"), { status: "invalid" });
  assert.deepEqual(prepareRecipesSettingsQuantityText("12\x7f3"), { status: "invalid" });

  assert.deepEqual(prepareRecipesSettingsQuantityText(null), { status: "invalid" });
  assert.deepEqual(prepareRecipesSettingsQuantityText(undefined), { status: "invalid" });
  assert.deepEqual(prepareRecipesSettingsQuantityText(12), { status: "invalid" });
});
