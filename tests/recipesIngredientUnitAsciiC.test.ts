import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesIngredientUnit,
  canonicalizeRecipesIngredientUnit,
  normalizeRecipesIngredientUnit
} from "../services/domain/presentationRecipesIngredientUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRecipesIngredientUnitIdentity.ts", import.meta.url),
  "utf8"
);
const recipesSource = readFileSync(new URL("../app/settings/recipes.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const inventoryDetailUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailUnitIdentity.ts",
  import.meta.url
);
const inventoryHubUnitIdentityPath = new URL(
  "../services/domain/presentationInventoryHubUnitIdentity.ts",
  import.meta.url
);
const inventoryRecipeUnitIdentityPath = new URL(
  "../services/domain/inventoryRecipeUnitIdentity.ts",
  import.meta.url
);
const recipesIngredientItemNameIdentityPath = new URL(
  "../services/domain/presentationRecipesIngredientItemNameIdentity.ts",
  import.meta.url
);

const unit = "cs";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ABI pins Settings Recipes ingredient.unit to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABI/);
  assert.match(recipesSource, /MISE-005ABI/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesIngredientUnit\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesIngredientUnitIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesIngredientUnit\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientUnit\(\s*ingredient\.unit\s*\)\s*\|\|\s*t\("recipes\.ingredient\.unit\.none"\)/
  );
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientUnit\(\s*selectedInventoryItem\?\.unit\s*\)\s*\|\|\s*t\("recipes\.ingredient\.unit\.none"\)/
  );
  assert.doesNotMatch(
    recipesSource,
    /styles\.quantityUnit[^>]*>\s*\{ingredient\.unit\}\s*<\/Text>/
  );
  assert.doesNotMatch(
    recipesSource,
    /unit:\s*ingredient\.unit/
  );
  assert.doesNotMatch(
    recipesSource,
    /selectedInventoryItem\?\.unit\s*\?\?\s*"--"/
  );

  assert.match(catalogSource, /"recipes\.ingredient\.unit\.none": "unit"/);
  assert.match(catalogSource, /"recipes\.ingredient\.unit\.none": "unidad"/);
  assert.match(catalogSource, /"recipes\.ingredient\.unit\.none": "单位"/);

  // Leave sibling Inventory detail / hub / recipe-mapping-write / itemName tips alone.
  assert.doesNotMatch(recipesSource, /normalizeInventoryDetailUnit/);
  assert.doesNotMatch(recipesSource, /normalizeInventoryHubUnit/);
  assert.doesNotMatch(recipesSource, /requireCanonicalInventoryRecipeUnit/);
  assert.doesNotMatch(recipesSource, /normalizeRecipesIngredientItemName/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryHubUnitIdentity/);
  assert.doesNotMatch(identitySource, /inventoryRecipeUnitIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecipesIngredientItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(inventoryDetailUnitIdentityPath), "absent");
  assert.equal(filePresence(inventoryHubUnitIdentityPath), "absent");
  assert.equal(filePresence(inventoryRecipeUnitIdentityPath), "absent");
  assert.equal(filePresence(recipesIngredientItemNameIdentityPath), "absent");

  // Leave the add-link write path raw for #864 recipe-mapping unit ownership.
  assert.match(
    recipesSource,
    /unit:\s*selectedInventoryItem\.unit/
  );

  // Leave ingredient.itemName / dish / missing-POS badge raw on this tip.
  assert.match(recipesSource, /\{ingredient\.itemName\}/);
  assert.match(recipesSource, /\{item\.menu_item_name\}/);

  assert.equal(normalizeRecipesIngredientUnit(unit), unit);
  assert.equal(normalizeRecipesIngredientUnit(` ${unit} `), unit);
  assert.equal(normalizeRecipesIngredientUnit(`case ${unit}`), `case ${unit}`);
});

test("Unicode padding invents via trim and is soft-nulled for Settings Recipes units", () => {
  const padded = `${em}${unit}${em}`;
  const nbspName = `${nbsp}${unit}${nbsp}`;
  const internalEm = `c${em}s`;
  const internalNbsp = `c${nbsp}s`;

  // Inventing proof: Unicode trim would invent the clean unit.
  assert.equal(padded.trim(), unit);
  assert.equal(nbspName.trim(), unit);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);
  // Builder preview previously used `?? "--"`; Unicode-only-space bypasses nullish.
  assert.equal(em ?? "--", em);
  assert.notEqual(em ?? "--", "--");

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipesIngredientUnit(padded), padded);
  assert.equal(canonicalizeRecipesIngredientUnit(padded), null);
  assert.equal(canonicalizeRecipesIngredientUnit(nbspName), null);
  assert.equal(normalizeRecipesIngredientUnit(padded), null);
  assert.equal(normalizeRecipesIngredientUnit(nbspName), null);
  assert.equal(normalizeRecipesIngredientUnit(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesIngredientUnit(internalEm), internalEm);
  assert.equal(normalizeRecipesIngredientUnit(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipesIngredientUnit(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings Recipes units", () => {
  assert.equal(normalizeRecipesIngredientUnit(undefined), null);
  assert.equal(normalizeRecipesIngredientUnit(null), null);
  assert.equal(normalizeRecipesIngredientUnit(""), null);
  assert.equal(normalizeRecipesIngredientUnit("   "), null);
  assert.equal(normalizeRecipesIngredientUnit(123 as unknown as string), null);
  assert.equal(normalizeRecipesIngredientUnit(`\u0001${unit}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesIngredientUnit(`${unit}\t`), unit);
  assert.equal(normalizeRecipesIngredientUnit(`${unit}\u0007`), null);
  assert.equal(normalizeRecipesIngredientUnit(em), null);
});

test("Settings Recipes bypass proof: empty and Unicode-only-space units soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking unit in quantityUnit,
  // readOnlyAccessibility, and builder preview (`?? "--"` bypass).
  assert.equal(normalizeRecipesIngredientUnit(""), null);
  assert.equal(normalizeRecipesIngredientUnit(em), null);
  assert.equal(normalizeRecipesIngredientUnit(nbsp), null);
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientUnit\(\s*ingredient\.unit\s*\)\s*\|\|\s*t\("recipes\.ingredient\.unit\.none"\)/
  );
  assert.match(
    recipesSource,
    /normalizeRecipesIngredientUnit\(\s*selectedInventoryItem\?\.unit\s*\)\s*\|\|\s*t\("recipes\.ingredient\.unit\.none"\)/
  );
  assert.match(recipesSource, /recipesIngredientDisplayUnit/);
  assert.match(
    recipesSource,
    /unit:\s*recipesIngredientDisplayUnit/
  );
});

test("Settings Recipes unit identity refuses Unicode inventing equality", () => {
  const padded = `${em}${unit}${em}`;
  assert.notEqual(asciiTrimRecipesIngredientUnit(padded), padded.trim());
  assert.equal(normalizeRecipesIngredientUnit(padded), null);
  assert.equal(normalizeRecipesIngredientUnit(`\t${unit}\n`), unit);
});
