import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDemoRecipeBaselineIngredientEntryText,
  canonicalizeDemoRecipeBaselineIngredientEntryText,
  prepareDemoRecipeBaselineIngredientEntryText
} from "../services/domain/demoRecipeBaselineIngredientEntryIdentity";
import { createInitialDemoState } from "../services/demo/replaceableDemoData";

const identitySource = readFileSync(
  new URL("../services/domain/demoRecipeBaselineIngredientEntryIdentity.ts", import.meta.url),
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

const entry = "chicken breast 0.25 lbs";
const accentedEntry = "café syrup 1 oz";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005RT pins demo recipe-baseline ingredient-entry identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005RT/);
  assert.match(replaceableSource, /MISE-005RT/);

  assert.match(
    identitySource,
    /export function asciiTrimDemoRecipeBaselineIngredientEntryText\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    replaceableSource,
    /from "\.\.\/domain\/demoRecipeBaselineIngredientEntryIdentity"/
  );
  assert.match(replaceableSource, /prepareDemoRecipeBaselineIngredientEntryText\(/);
  assert.match(replaceableSource, /preparedEntry\.status !== "ok"/);
  assert.match(replaceableSource, /return preparedEntry\.text;/);
  assert.doesNotMatch(replaceableSource, /\.map\(\(entry\) => entry\.trim\(\)\)/);

  // Leave menuItemName bare Unicode trim alone (open #905 / MISE-005RS).
  assert.match(replaceableSource, /menuItemName: menuItemName\.trim\(\)/);
  assert.doesNotMatch(replaceableSource, /prepareDemoRecipeBaselineMenuItemNameText\(/);
  assert.doesNotMatch(replaceableSource, /demoRecipeBaselineMenuItemNameIdentity/);

  // Leave ingredient itemName / unit bare trim alone until their own tips.
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
  assert.doesNotMatch(setupListBody, /prepareDemoRecipeBaselineIngredientEntryText/);

  // Leave setup-drafts ingredient itemName inventing alone (open #898 / MISE-005RL).
  assert.match(setupDraftsSource, /ingredient\.itemName\.trim\(\)/);
  assert.doesNotMatch(setupDraftsSource, /demoRecipeBaselineIngredientEntryIdentity/);
  assert.doesNotMatch(setupDraftsSource, /prepareDemoRecipeBaselineIngredientEntryText\(/);
  assert.doesNotMatch(setupDraftsSource, /normalizeSetupDraftsRecipeIngredientItemNameText\(/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /prepareDemoRecipeBaselineMenuItemNameText/);
  assert.doesNotMatch(identitySource, /demoRecipeBaselineMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /normalizeSetupDraftsRecipeIngredientItemNameText/);
  assert.doesNotMatch(identitySource, /setupDraftsRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(identitySource, /asciiCTrim/);
  assert.doesNotMatch(
    identitySource,
    /from ["']\.\/demoRecipeBaselineMenuItemNameIdentity["']/
  );
  assert.doesNotMatch(replaceableSource, /setupDraftsRecipeIngredientItemNameIdentity/);
  assert.doesNotMatch(replaceableSource, /normalizeSetupDraftsRecipeIngredientItemNameText/);
});

test("ASCII trim keeps ordinary demo recipe-baseline ingredient entries stable", () => {
  assert.equal(asciiTrimDemoRecipeBaselineIngredientEntryText(`  ${entry}  `), entry);
  assert.equal(asciiTrimDemoRecipeBaselineIngredientEntryText(`\t${entry}\n`), entry);
  assert.deepEqual(canonicalizeDemoRecipeBaselineIngredientEntryText(`  ${entry}  `), {
    status: "ok",
    text: entry
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(`  ${entry}  `), {
    status: "ok",
    text: entry
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(accentedEntry), {
    status: "ok",
    text: accentedEntry
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText("rice 0.4 lbs"), {
    status: "ok",
    text: "rice 0.4 lbs"
  });

  // Soft empty stays empty (prior entry.trim() empty path).
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText("   "), { status: "empty" });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText("\t\n"), { status: "empty" });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(""), { status: "empty" });
});

test("NBSP and em-space padding cannot invent a clean demo recipe-baseline ingredient entry", () => {
  const nbspEntry = `${nbsp}${entry}${nbsp}`;
  const emEntry = `${em}${entry}${em}`;

  // Live inventing proof on Unicode trim (what entry.trim() previously did).
  assert.equal(nbspEntry.trim(), entry);
  assert.equal(emEntry.trim(), entry);
  assert.equal(em.trim(), "");

  assert.deepEqual(canonicalizeDemoRecipeBaselineIngredientEntryText(nbspEntry), {
    status: "invalid"
  });
  assert.deepEqual(canonicalizeDemoRecipeBaselineIngredientEntryText(emEntry), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(nbspEntry), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(emEntry), {
    status: "invalid"
  });

  // Soft empty Unicode-only padding falls through like prior empty path,
  // and must not invent an ok draft from a padded entry.
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(`${em}${em}`), {
    status: "empty"
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(`${nbsp}${nbsp}`), {
    status: "empty"
  });
  assert.notDeepEqual(prepareDemoRecipeBaselineIngredientEntryText(emEntry), {
    status: "empty"
  });
  assert.notDeepEqual(prepareDemoRecipeBaselineIngredientEntryText(emEntry), {
    status: "ok",
    text: entry
  });

  // Internal Unicode spaces are not stripped; they remain durable content
  // (and typically fail the quantity/unit regex rather than inventing).
  assert.deepEqual(
    prepareDemoRecipeBaselineIngredientEntryText(`chicken${em}breast 0.25 lbs`),
    {
      status: "ok",
      text: `chicken${em}breast 0.25 lbs`
    }
  );
  assert.deepEqual(
    prepareDemoRecipeBaselineIngredientEntryText(`chicken${nbsp}breast 0.25 lbs`),
    {
      status: "ok",
      text: `chicken${nbsp}breast 0.25 lbs`
    }
  );

  // Durable apply path: Unicode-padded ingredient entries fail closed and do
  // not invent clean menu-item ingredient mappings. Use a dish name absent
  // from the seeded demo catalog so leftover defaults cannot mask a skipped
  // padded entry. Keep the dish token ASCII-clean so this tip does not depend
  // on open #905 / MISE-005RS menuItemName pinning.
  const uniqueDish = "Unique Demo Bowl";
  const inventedState = createInitialDemoState("Square", {
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: `${uniqueDish}: ${em}chicken breast 0.25 lbs${em}, ${em}rice 0.4 lbs${em}`
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
    recipeBaselineText: `${uniqueDish}:   chicken breast 0.25 lbs  ,  rice 0.4 lbs  `
  });
  assert.equal(
    cleanState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === uniqueDish
    ).length,
    2
  );

  // Mixed line: padded entry skipped, ASCII-clean sibling still maps.
  const mixedState = createInitialDemoState("Square", {
    inventoryItemNames: ["Duck breast", "Jasmine rice"],
    recipeBaselineText: `${uniqueDish}: ${em}chicken breast 0.25 lbs${em}, rice 0.4 lbs`
  });
  assert.equal(
    mixedState.menuItemIngredients.filter(
      (mapping) => mapping.menu_item_name === uniqueDish
    ).length,
    1
  );
});

test("ASCII controls and non-string demo recipe-baseline ingredient entry drafts fail closed without inventing", () => {
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineIngredientEntryText("chicken\nbreast 0.25 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineIngredientEntryText("chicken\rbreast 0.25 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineIngredientEntryText("chicken\x01breast 0.25 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    canonicalizeDemoRecipeBaselineIngredientEntryText("chicken\x7fbreast 0.25 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    prepareDemoRecipeBaselineIngredientEntryText("chicken\nbreast 0.25 lbs"),
    { status: "invalid" }
  );
  assert.deepEqual(
    prepareDemoRecipeBaselineIngredientEntryText("chicken\x7fbreast 0.25 lbs"),
    { status: "invalid" }
  );

  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(null), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(undefined), {
    status: "invalid"
  });
  assert.deepEqual(prepareDemoRecipeBaselineIngredientEntryText(12), {
    status: "invalid"
  });
});
