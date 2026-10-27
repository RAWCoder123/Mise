import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDemoRecipeBaselineMenuItemNameText,
  canonicalizeDemoRecipeBaselineMenuItemNameText,
  prepareDemoRecipeBaselineMenuItemNameText
} from "../services/domain/demoRecipeBaselineMenuItemNameIdentity";
import { createInitialDemoState } from "../services/demo/replaceableDemoData";

const identitySource = readFileSync(
  new URL("../services/domain/demoRecipeBaselineMenuItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const replaceableSource = readFileSync(
  new URL("../services/demo/replaceableDemoData.ts", import.meta.url),
  "utf8"
);
const setupDraftsSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

const dishName = "Chicken Bowl";
const accentedName = "Café Bowl";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RS pins demo recipe-baseline menuItemName identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RS/);
  assert.match(replaceableSource, /MISE-005RS/);

  assert.match(
    identitySource,
    /export function asciiTrimDemoRecipeBaselineMenuItemNameText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    replaceableSource,
    /from "\.\.\/domain\/demoRecipeBaselineMenuItemNameIdentity"/
  );
  assert.match(replaceableSource, /prepareDemoRecipeBaselineMenuItemNameText\(/);
  assert.match(replaceableSource, /preparedMenuItemName\.status !== "ok"/);
  assert.match(replaceableSource, /menuItemName: preparedMenuItemName\.text/);
  assert.doesNotMatch(replaceableSource, /menuItemName: menuItemName\.trim\(\)/);

  // Leave ingredient itemName / unit / comma-entry bare trim alone.
  assert.match(replaceableSource, /\.map\(\(entry\) => entry\.trim\(\)\)/);
  assert.match(replaceableSource, /itemName: match\[1\]!\.trim\(\)/);
  assert.match(replaceableSource, /unit: match\[3\]!\.trim\(\)/);

  // Leave soft-empty baseline text / line trim alone.
  assert.match(replaceableSource, /if \(!recipeBaselineText\?\.trim\(\)\) return;/);
  assert.match(replaceableSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Leave normalizeSetupList Unicode/main path alone for open #686 / MISE-005JQ.
  const setupListStart = replaceableSource.indexOf("function normalizeSetupList(");
  assert.ok(setupListStart >= 0);
  const setupListBody = replaceableSource.slice(
    setupListStart,
    replaceableSource.indexOf("\nfunction ", setupListStart + 1)
  );
  assert.match(setupListBody, /\.map\(\(value\) => value\.trim\(\)\)/);
  assert.doesNotMatch(setupListBody, /prepareDemoRecipeBaselineMenuItemNameText/);

  // Leave setup-drafts dishName inventing alone (open #900 / MISE-005RN).
  assert.match(setupDraftsSource, /const dishName = recipe\.dishName\.trim\(\);/);
  assert.doesNotMatch(setupDraftsSource, /demoRecipeBaselineMenuItemNameIdentity/);
  assert.doesNotMatch(setupDraftsSource, /prepareDemoRecipeBaselineMenuItemNameText\(/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeDishNameText\(/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeDishNameText/);
  assert.doesNotMatch(identitySource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(identitySource, /setupRecipeDishNameIdentity/);
  assert.doesNotMatch(identitySource, /normalizeReplaceableDemoSetupKey/);
  assert.doesNotMatch(identitySource, /asciiCTrim/);
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/setupDraftsRecipeDishNameIdentity["']/
  );
  assert.doesNotMatch(replaceableSource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(replaceableSource, /normalizeSetupDraftsRecipeDishNameText/);
});

test("ASCII trim keeps ordinary demo recipe-baseline menu item names stable", () => {
  assert.equal(
    asciiTrimDemoRecipeBaselineMenuItemNameText(`  ${dishName}  `),
    dishName
  );
  assert.equal(
    asciiTrimDemoRecipeBaselineMenuItemNameText(`\t${dishName}\n`),
    dishName
  );
  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText(`  ${dishName}  `), {
    status: "ok",
    text: dishName
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(`  ${dishName}  `), {
    status: "ok",
    text: dishName
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(accentedName), {
    status: "ok",
    text: accentedName
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText("General Tso Chicken"), {
    status: "ok",
    text: "General Tso Chicken"
  });

  // Soft empty stays empty (prior menuItemName.trim() empty path).
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText("   "), { status: "empty" });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean demo recipe-baseline menu item name", () => {
  const nbspName = `${nbsp}${dishName}${nbsp}`;
  const emName = `${em}${dishName}${em}`;

  // Live inventing proof on Unicode trim (what menuItemName.trim() previously did).
  assert.equal(nbspName.trim(), dishName);
  assert.equal(emName.trim(), dishName);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText(emName), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(nbspName), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(emName), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior empty path,
  // and must not invent an ok draft from a padded name.
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareDemoRecipeBaselineMenuItemNameText(emName), {
    status: "empty"
  });
  assert.notDeepEqual(prepareDemoRecipeBaselineMenuItemNameText(emName), {
    status: "ok",
    text: dishName
  });

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(`Chicken${em}Bowl`), {
    status: "ok",
    text: `Chicken${em}Bowl`
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(`Chicken${nbsp}Bowl`), {
    status: "ok",
    text: `Chicken${nbsp}Bowl`
  });

  // Durable apply path: Unicode-padded dish names fail closed and do not invent
  // clean menu_item_name mappings. Use a dish name absent from the seeded
  // demo catalog so leftover defaults cannot mask a skipped padded line.
  const uniqueDish = "Unique Demo Bowl";
  const inventedState = createInitialDemoState("Square", {
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: `${em}${uniqueDish}${em}: chicken breast 0.25 lbs, rice 0.4 lbs`
  });
  assert.equal(
    inventedState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === uniqueDish
    ).length,
    0
  );
  assert.equal(
    inventedState.menuItemIngredients.filter((mapping) =>
      mapping.menu_item_name.includes("Unique Demo")
    ).length,
    0
  );

  const cleanState = createInitialDemoState("Square", {
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: `  ${uniqueDish}  : chicken breast 0.25 lbs, rice 0.4 lbs`
  });
  assert.equal(
    cleanState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === uniqueDish
    ).length,
    2
  );
});

test("ASCII controls and non-string demo recipe-baseline menu item name drafts fail closed without inventing", () => {
  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText("Chicken\nBowl"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText("Chicken\rBowl"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText("Chicken\x01Bowl"), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeDemoRecipeBaselineMenuItemNameText("Chicken\x7fBowl"), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText("Chicken\nBowl"), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText("Chicken\x7fBowl"), {
    status: "invalid"
  });

  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(null), { status: "invalid" });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineMenuItemNameText(12), { status: "invalid" });
});
