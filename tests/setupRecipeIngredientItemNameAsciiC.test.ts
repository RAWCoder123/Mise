import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRecipeIngredientItemNameText,
  canonicalizeSetupRecipeIngredientItemNameText,
  prepareSetupRecipeIngredientItemNameText
} from "../services/domain/setupRecipeIngredientItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupRecipeIngredientItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);
const applicationSetupSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const itemName = "Tomato";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RO pins setup recipe ingredient itemName draft identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RO/);
  assert.match(setupSource, /MISE-005RO/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRecipeIngredientItemNameText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupRecipeIngredientItemNameIdentity"/
  );
  assert.match(setupSource, /prepareSetupRecipeIngredientItemNameText\(/);
  assert.match(setupSource, /normalizeSetupRecipeIngredientItemName\(/);
  assert.match(
    setupSource,
    /itemName: normalizeSetupRecipeIngredientItemName\(ingredient\.itemName\)/
  );
  assert.doesNotMatch(
    setupSource,
    /if \(!ingredient\.itemName\.trim\(\) \|\| !ingredient\.quantity\.trim\(\) \|\| !ingredient\.unit\.trim\(\)\)/
  );
  assert.doesNotMatch(
    setupSource,
    /const ingredientLabel = ingredient\.itemName\.trim\(\) \|\| t\("setup\.validation\.ingredientLabel"/
  );

  // Leave started-ingredient detection on the prior bare itemName.trim contract
  // (open #898 asserts setup.tsx still uses ingredient.itemName.trim somewhere).
  assert.match(
    setupSource,
    /ingredient\.itemName\.trim\(\) \|\| ingredient\.quantity\.trim\(\)/
  );

  // Leave setup recipe ingredient quantity on the prior bare contract (open #896).
  assert.match(
    setupSource,
    /isBoundedSetupNumber\(ingredient\.quantity, Number\.EPSILON, operatingLimits\.recipeQuantityPerSale, parseNumber\)/
  );
  assert.match(setupSource, /quantity: normalizeDraftNumber\(ingredient\.quantity, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupRecipeIngredientQuantityText\(/);
  assert.doesNotMatch(setupSource, /setupRecipeIngredientQuantityIdentity/);

  // Leave setup recipe ingredient unit on the prior bare trim contract.
  assert.match(setupSource, /!ingredient\.unit\.trim\(\)/);

  // Leave setup-drafts recipe ingredient itemName on the prior bare contract
  // (open #898) until that tip owns it.
  assert.match(setupDraftsSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeIngredientItemNameText\(/);
  assert.doesNotMatch(setupDraftsSource, /setupDraftsRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(setupDraftsSource, /setupRecipeIngredientItemNameIdentity/);

  // Leave application setup ingredient.itemName.trim lookup alone.
  assert.match(applicationSetupSource, /const ingredientName = ingredient\.itemName\.trim\(\);/);
  assert.doesNotMatch(applicationSetupSource, /setupRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(applicationSetupSource, /prepareSetupRecipeIngredientItemNameText\(/);

  // Leave setup inventory quantity / parLevel on their prior bare contracts.
  assert.match(
    setupSource,
    /if \(!item\.quantity\.trim\(\)\) return setupValidationFailure\("inventory", t\("setup\.validation\.needsQuantity"/
  );
  assert.match(setupSource, /parLevel: normalizeDraftNumber\(item\.parLevel, parseNumber\)/);
  assert.doesNotMatch(setupSource, /prepareSetupInventoryQuantityText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryQuantityIdentity/);
  assert.doesNotMatch(setupSource, /prepareSetupInventoryParLevelText\(/);
  assert.doesNotMatch(setupSource, /setupInventoryParLevelIdentity/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareSetupRecipeIngredientQuantityText/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /prepareSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryQuantityText/);
  assert.doesNotMatch(identitySource, /prepareSetupInventoryParLevelText/);
  assert.doesNotMatch(identitySource, /normalizeCanonicalSetupRecipeDishName/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeIngredientQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupDraftsRecipeIngredientItemNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryQuantityIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryParLevelIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupRecipeDishNameIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["']\.\/setupInventoryUnitIdentity["']/);

  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupDraftsRecipeIngredientItemNameIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupRecipeIngredientQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryQuantityIdentity"/
  );
  assert.doesNotMatch(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/setupInventoryParLevelIdentity"/
  );
});

test("ASCII trim keeps ordinary setup recipe ingredient itemName drafts stable", () => {
  assert.equal(asciiTrimSetupRecipeIngredientItemNameText(`  ${itemName}  `), itemName);
  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText(`\t${itemName}\n`), {
    status: "ok",
    text: itemName
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(`  ${itemName}  `), {
    status: "ok",
    text: itemName
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("Mozzarella"), {
    status: "ok",
    text: "Mozzarella"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("San Marzano"), {
    status: "ok",
    text: "San Marzano"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("Café"), {
    status: "ok",
    text: "Café"
  });

  // Prior emptiness contract: ASCII-only whitespace softs to empty (required itemName).
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("   "), { status: "empty" });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean setup recipe ingredient itemName", () => {
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const emName = `${em}${itemName}${em}`;

  // Live inventing proof on Unicode trim (what ingredient.itemName.trim() and
  // application ingredient.itemName.trim() do, and what setup recipe ingredient
  // itemName previously fed unprepared into labels / normalize / save).
  assert.equal(nbspName.trim(), itemName);
  assert.equal(emName.trim(), itemName);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText(emName), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(emName), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior required emptiness,
  // and must not invent an ok draft from a padded name.
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupRecipeIngredientItemNameText(emName), {
    status: "empty"
  });
  assert.notDeepEqual(prepareSetupRecipeIngredientItemNameText(emName), {
    status: "ok",
    text: itemName
  });

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(`Tom${em}ato`), {
    status: "ok",
    text: `Tom${em}ato`
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(`San${nbsp}Marzano`), {
    status: "ok",
    text: `San${nbsp}Marzano`
  });
});

test("ASCII controls and non-string setup recipe ingredient itemName drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText("Tom\nato"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText("Tom\rato"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText("Tom\x01ato"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeSetupRecipeIngredientItemNameText("Tom\x7fato"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("Tom\nato"), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText("Tom\x7fato"), {
    status: "invalid"
  });

  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(null), { status: "invalid" });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareSetupRecipeIngredientItemNameText(12), { status: "invalid" });
});
