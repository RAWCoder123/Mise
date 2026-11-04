import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRecipesBuilderInventoryItemName,
  canonicalizeRecipesBuilderInventoryItemName,
  normalizeRecipesBuilderInventoryItemName
} from "../services/domain/presentationRecipesBuilderInventoryItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRecipesBuilderInventoryItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const recipesSource = readFileSync(new URL("../app/settings/recipes.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const itemName = "Avocado";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XW pins Recipes builder inventory SuggestionChip item.item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005XW/);
  assert.match(recipesSource, /MISE-005XW/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipesBuilderInventoryItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    recipesSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRecipesBuilderInventoryItemNameIdentity"/
  );
  assert.match(recipesSource, /normalizeRecipesBuilderInventoryItemName\(/);
  assert.match(
    recipesSource,
    /normalizeRecipesBuilderInventoryItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("recipes\.builder\.inventoryItemName\.none"\)/
  );
  assert.doesNotMatch(recipesSource, /label=\{item\.item_name\}/);

  assert.match(catalogSource, /"recipes\.builder\.inventoryItemName\.none": "Inventory item"/);
  assert.match(catalogSource, /"recipes\.builder\.inventoryItemName\.none": "Artículo de inventario"/);
  assert.match(catalogSource, /"recipes\.builder\.inventoryItemName\.none": "库存项目"/);

  // Leave POS missing-recipe badge itemName alone (open #1082 / MISE-005XV).
  assert.doesNotMatch(recipesSource, /normalizeRecipesPosMissingItemName/);
  assert.doesNotMatch(identitySource, /presentationRecipesPosMissingItemNameIdentity/);

  // Leave recipes.notice.linked alone (open #1081 / MISE-005XU).
  assert.doesNotMatch(recipesSource, /normalizeRecipesNoticeLinkedIngredientName/);
  assert.doesNotMatch(recipesSource, /normalizeRecipesNoticeLinkedDishName/);
  assert.doesNotMatch(identitySource, /presentationRecipesNoticeLinkedIngredientIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecipesNoticeLinkedDishIdentity/);

  // Leave Recipes dish menu_item_name / confirmed alone (open #1080 / MISE-005XT).
  assert.doesNotMatch(recipesSource, /normalizeRecipesDishMenuItemName/);
  assert.match(recipesSource, /<Text style=\{styles\.recipeName\}>\{item\.menu_item_name\}<\/Text>/);
  assert.match(
    recipesSource,
    /setNotice\(t\("recipes\.notice\.confirmed", \{\s*item: item\.menu_item_name\s*\}\)\)/
  );

  // Leave Recipes ingredient.itemName row chrome alone (open #1067 / MISE-005XG).
  assert.doesNotMatch(recipesSource, /normalizeRecipesIngredientItemName/);
  assert.match(recipesSource, /\{ingredient\.itemName\}/);

  // Leave Inventory hub / recipe-baseline inventory itemName modules alone.
  assert.doesNotMatch(identitySource, /presentationInventoryHubItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationRecipeBaselineInventoryItemNameIdentity/);
  assert.doesNotMatch(recipesSource, /normalizeInventoryHubItemName/);
  assert.doesNotMatch(recipesSource, /normalizeRecipeBaselineInventoryItemName/);

  // Leave React list keys on durable item.id (not presentation chrome).
  assert.match(recipesSource, /key=\{item\.id\}/);

  // Leave builder SuggestionChip onPress write-back and selectedInventoryItem
  // Unicode-trim equality gate alone.
  assert.match(recipesSource, /onPress=\{\(\) => onInventoryItemNameChange\(item\.item_name\)\}/);
  assert.match(
    recipesSource,
    /const normalized = newInventoryItemName\.trim\(\)\.toLowerCase\(\);/
  );
  assert.match(
    recipesSource,
    /visibleInventoryItems\.find\(\(item\) => item\.item_name\.toLowerCase\(\) === normalized\)/
  );

  // Leave domain / other hubs alone (executable code only; the module header
  // may name neighboring tips when documenting scope).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /posItemsMissingRecipes/);
  assert.doesNotMatch(identityCode, /miseDomain/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRecipesBuilderInventoryItemName(itemName), itemName);
  assert.equal(normalizeRecipesBuilderInventoryItemName(` ${itemName} `), itemName);
  assert.equal(
    normalizeRecipesBuilderInventoryItemName(`Artículo ${itemName}`),
    `Artículo ${itemName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for builder inventory chip names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Ripe${em}Avocado`;
  const internalNbsp = `Ripe${nbsp}Avocado`;

  // Inventing proof: Unicode trim would invent the clean inventory item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRecipesBuilderInventoryItemName(padded), padded);
  assert.equal(canonicalizeRecipesBuilderInventoryItemName(padded), null);
  assert.equal(canonicalizeRecipesBuilderInventoryItemName(nbspName), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(padded), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(nbspName), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRecipesBuilderInventoryItemName(internalEm), internalEm);
  assert.equal(normalizeRecipesBuilderInventoryItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeRecipesBuilderInventoryItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for builder inventory chip names", () => {
  assert.equal(normalizeRecipesBuilderInventoryItemName(undefined), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(null), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(""), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName("   "), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(em), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(123 as unknown as string), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRecipesBuilderInventoryItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeRecipesBuilderInventoryItemName(`${itemName}\n`), itemName);
  assert.equal(normalizeRecipesBuilderInventoryItemName(`\t${itemName}`), itemName);
  assert.equal(normalizeRecipesBuilderInventoryItemName(`${itemName}\u0007`), null);
});

test("builder inventory chip bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking inventory-item
  // identity on the builder SuggestionChip labels.
  assert.equal(normalizeRecipesBuilderInventoryItemName(""), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(em), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(nbsp), null);
  assert.match(
    recipesSource,
    /normalizeRecipesBuilderInventoryItemName\(item\.item_name\)\s*\|\|\s*\n?\s*t\("recipes\.builder\.inventoryItemName\.none"\)/
  );
  assert.equal(
    normalizeRecipesBuilderInventoryItemName(em) || "Inventory item",
    "Inventory item"
  );
});

test("builder inventory chip item.item_name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${itemName}${em}`;
  assert.notEqual(asciiTrimRecipesBuilderInventoryItemName(padded), padded.trim());
  assert.equal(normalizeRecipesBuilderInventoryItemName(padded), null);
  assert.equal(normalizeRecipesBuilderInventoryItemName(`\t${itemName}\n`), itemName);
});
