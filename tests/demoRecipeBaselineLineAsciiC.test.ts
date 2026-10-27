import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDemoRecipeBaselineLineText,
  canonicalizeDemoRecipeBaselineLineText,
  prepareDemoRecipeBaselineLineText
} from "../services/domain/demoRecipeBaselineLineIdentity";
import { createInitialDemoState } from "../services/demo/replaceableDemoData";

const identitySource = readFileSync(
  new URL("../services/domain/demoRecipeBaselineLineIdentity.ts", import.meta.url),
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

const line = "Unique Demo Bowl: chicken breast 0.25 lbs, rice 0.4 lbs";
const accentedLine = "Café Bowl: café syrup 1 oz";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RU pins demo recipe-baseline line identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RU/);
  assert.match(replaceableSource, /MISE-005RU/);

  assert.match(
    identitySource,
    /export function asciiTrimDemoRecipeBaselineLineText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    replaceableSource,
    /from "\.\.\/domain\/demoRecipeBaselineLineIdentity"/
  );
  assert.match(replaceableSource, /prepareDemoRecipeBaselineLineText\(/);
  assert.match(replaceableSource, /preparedLine\.status !== "ok"/);
  assert.match(replaceableSource, /return preparedLine\.text;/);
  assert.doesNotMatch(replaceableSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Leave menuItemName bare Unicode trim alone (open #905 / MISE-005RS).
  assert.match(replaceableSource, /menuItemName: menuItemName\.trim\(\)/);
  assert.doesNotMatch(replaceableSource, /prepareDemoRecipeBaselineMenuItemNameText\(/);
  assert.doesNotMatch(replaceableSource, /demoRecipeBaselineMenuItemNameIdentity/);

  // Leave comma-entry bare trim alone (open #906 / MISE-005RT).
  assert.match(replaceableSource, /\.map\(\(entry\) => entry\.trim\(\)\)/);
  assert.doesNotMatch(replaceableSource, /prepareDemoRecipeBaselineIngredientEntryText\(/);
  assert.doesNotMatch(replaceableSource, /demoRecipeBaselineIngredientEntryIdentity/);

  // Leave ingredient itemName / unit bare trim alone until inventing is proved.
  assert.match(replaceableSource, /itemName: match\[1\]!\.trim\(\)/);
  assert.match(replaceableSource, /unit: match\[3\]!\.trim\(\)/);

  // Leave soft-empty baseline text alone (emptiness-only gate).
  assert.match(replaceableSource, /if \(!recipeBaselineText\?\.trim\(\)\) return;/);

  // Leave normalizeSetupList Unicode/main path alone for open #686 / MISE-005JQ.
  const setupListStart = replaceableSource.indexOf("function normalizeSetupList(");
  assert.ok(setupListStart >= 0);
  const setupListBody = replaceableSource.slice(
    setupListStart,
    replaceableSource.indexOf("\nfunction ", setupListStart + 1)
  );
  assert.match(setupListBody, /\.map\(\(value\) => value\.trim\(\)\)/);
  assert.doesNotMatch(setupListBody, /prepareDemoRecipeBaselineLineText/);

  // Leave setup-drafts dishName inventing alone (open #900 / MISE-005RN).
  assert.match(setupDraftsSource, /const dishName = recipe\.dishName\.trim\(\);/);
  assert.doesNotMatch(setupDraftsSource, /demoRecipeBaselineLineIdentity/);
  assert.doesNotMatch(setupDraftsSource, /prepareDemoRecipeBaselineLineText\(/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeDishNameText\(/);

  // Leave setup-drafts POS CSV line.trim alone (distinct import path).
  assert.match(setupDraftsSource, /\.map\(\(line\) => line\.trim\(\)\)/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareDemoRecipeBaselineMenuItemNameText/);
  assert.doesNotMatch(identitySource, /demoRecipeBaselineMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /prepareDemoRecipeBaselineIngredientEntryText/);
  assert.doesNotMatch(identitySource, /demoRecipeBaselineIngredientEntryIdentity/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeDishNameText/);
  assert.doesNotMatch(identitySource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(identitySource, /asciiCTrim/);
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/demoRecipeBaselineMenuItemNameIdentity["']/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/demoRecipeBaselineIngredientEntryIdentity["']/
  );
  assert.doesNotMatch(replaceableSource, /setupDraftsRecipeDishNameIdentity/);
  assert.doesNotMatch(replaceableSource, /normalizeSetupDraftsRecipeDishNameText/);
});

test("ASCII trim keeps ordinary demo recipe-baseline lines stable", () => {
  assert.equal(asciiTrimDemoRecipeBaselineLineText(`  ${line}  `), line);
  assert.equal(asciiTrimDemoRecipeBaselineLineText(`\t${line}\n`), line);
  assert.deepEqual(canonicalizeDemoRecipeBaselineLineText(`  ${line}  `), {
    status: "ok",
    text: line
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(`  ${line}  `), {
    status: "ok",
    text: line
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(accentedLine), {
    status: "ok",
    text: accentedLine
  });
  assert.deepEqual(
    prepareDemoRecipeBaselineLineText("Unique Demo Bowl: rice 0.4 lbs"),
    {
      status: "ok",
      text: "Unique Demo Bowl: rice 0.4 lbs"
    }
  );

  // Soft empty stays empty (prior line.trim() empty path).
  assert.deepEqual(prepareDemoRecipeBaselineLineText("   "), { status: "empty" });
  assert.deepEqual(prepareDemoRecipeBaselineLineText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean demo recipe-baseline line", () => {
  const nbspLine = `${nbsp}${line}${nbsp}`;
  const emLine = `${em}${line}${em}`;

  // Live inventing proof on Unicode trim (what line.trim() previously did).
  assert.equal(nbspLine.trim(), line);
  assert.equal(emLine.trim(), line);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeDemoRecipeBaselineLineText(nbspLine), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeDemoRecipeBaselineLineText(emLine), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(nbspLine), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(emLine), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior empty path,
  // and must not invent an ok draft from a padded line.
  assert.deepEqual(prepareDemoRecipeBaselineLineText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareDemoRecipeBaselineLineText(emLine), {
    status: "empty"
  });
  assert.notDeepEqual(prepareDemoRecipeBaselineLineText(emLine), {
    status: "ok",
    text: line
  });

  // Internal Unicode spaces are not stripped; they remain durable content
  // (and typically fail parseRecipeLine rather than inventing).
  assert.deepEqual(
    prepareDemoRecipeBaselineLineText(`Unique${em}Demo Bowl: rice 0.4 lbs`),
    {
      status: "ok",
      text: `Unique${em}Demo Bowl: rice 0.4 lbs`
    }
  );
  assert.deepEqual(
    prepareDemoRecipeBaselineLineText(`Unique${nbsp}Demo Bowl: rice 0.4 lbs`),
    {
      status: "ok",
      text: `Unique${nbsp}Demo Bowl: rice 0.4 lbs`
    }
  );

  // Durable apply path: Unicode-padded lines fail closed and do not invent
  // clean menu-item ingredient mappings. Use a dish name absent from the
  // seeded demo catalog so leftover defaults cannot mask a skipped padded
  // line. Keep dish / entry tokens ASCII-clean inside the line so this tip
  // does not depend on open #905 / MISE-005RS or #906 / MISE-005RT.
  const uniqueDish = "Unique Demo Bowl";
  const inventedState = createInitialDemoState("Square", {
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: `${em}${uniqueDish}: chicken breast 0.25 lbs, rice 0.4 lbs${em}`
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
    recipeBaselineText: `  ${uniqueDish}: chicken breast 0.25 lbs, rice 0.4 lbs  `
  });
  assert.equal(
    cleanState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === uniqueDish
    ).length,
    2
  );

  // Mixed multiline: padded line skipped, ASCII-clean sibling still maps.
  const siblingDish = "Unique Sibling Bowl";
  const mixedState = createInitialDemoState("Square", {
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: [
      `${em}${uniqueDish}: chicken breast 0.25 lbs, rice 0.4 lbs${em}`,
      `${siblingDish}: rice 0.4 lbs`
    ].join("\n")
  });
  assert.equal(
    mixedState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === uniqueDish
    ).length,
    0
  );
  assert.equal(
    mixedState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === siblingDish
    ).length,
    1
  );
});

test("ASCII controls and non-string demo recipe-baseline line drafts fail closed without inventing", () => {
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineLineText("Unique\nDemo Bowl: rice 0.4 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineLineText("Unique\rDemo Bowl: rice 0.4 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineLineText("Unique\x01Demo Bowl: rice 0.4 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineLineText("Unique\x7fDemo Bowl: rice 0.4 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    prepareDemoRecipeBaselineLineText("Unique\nDemo Bowl: rice 0.4 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    prepareDemoRecipeBaselineLineText("Unique\x7fDemo Bowl: rice 0.4 lbs"),
    { status: "invalid" }
  );

  assert.deepEqual(prepareDemoRecipeBaselineLineText(null), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineLineText(12), {
    status: "invalid"
  });
});
