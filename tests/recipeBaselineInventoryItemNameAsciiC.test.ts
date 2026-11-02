import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRecipeBaselineSummary } from "../services/domain/miseDomain";
import {
  asciiTrimRecipeBaselineInventoryItemName,
  canonicalizeRecipeBaselineInventoryItemName,
  normalizeRecipeBaselineInventoryItemName
} from "../services/domain/presentationRecipeBaselineInventoryItemNameIdentity";
import type { InventoryItem, MenuItemIngredient } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/presentationRecipeBaselineInventoryItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const inventoryDetailSource = readFileSync(
  new URL("../app/inventory/[id].tsx", import.meta.url),
  "utf8"
);
const wasteSource = readFileSync(new URL("../app/more/waste.tsx", import.meta.url), "utf8");
const recipesSettingsSource = readFileSync(
  new URL("../app/settings/recipes.tsx", import.meta.url),
  "utf8"
);

const inventoryLabel = "Chicken breast";
const accentedInventory = "Crème fraîche";
const FALLBACK = "Inventory item";
const em = "\u2003";
const nbsp = "\u00a0";
const restaurantId = "rest_ascii_c_recipe_baseline";
const operatingDate = "2026-11-02";

function inventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_ascii_c_recipe_baseline",
    restaurant_id: restaurantId,
    item_name: inventoryLabel,
    category: "Proteins",
    unit: "lb",
    current_quantity: 12,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 4.5,
    supplier_id: "sup_ascii_c_recipe_baseline",
    supplier_name: "Harbor Produce",
    last_updated: "2026-11-02T07:00:00.000Z",
    ...overrides
  };
}

function mapping(overrides: Partial<MenuItemIngredient> = {}): MenuItemIngredient {
  return {
    id: "map_ascii_c_recipe_baseline",
    restaurant_id: restaurantId,
    menu_item_name: "Chicken Bowl",
    inventory_item_id: "inv_ascii_c_recipe_baseline",
    quantity_used_per_sale: 0.5,
    unit: "lb",
    ...overrides
  };
}

test("MISE-005WA pins miseDomain recipe-baseline inventory itemName to ASCII C", () => {
  assert.match(identitySource, /MISE-005WA/);
  assert.match(miseDomainSource, /MISE-005WA/);

  assert.match(
    identitySource,
    /export function asciiTrimRecipeBaselineInventoryItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Inventory item-name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimRecipeBaselineInventoryItemName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    miseDomainSource,
    /from "\.\/presentationRecipeBaselineInventoryItemNameIdentity"/
  );
  assert.match(miseDomainSource, /normalizeRecipeBaselineInventoryItemName\(/);
  assert.match(
    miseDomainSource,
    /normalizeRecipeBaselineInventoryItemName\(itemNames\.get\(mapping\.inventory_item_id\)\)\s*\?\?\s*"Inventory item"/
  );
  // Both ingredient.itemName and linkedInventoryItems must soft-null before the fallback.
  assert.equal(
    (
      miseDomainSource.match(
        /normalizeRecipeBaselineInventoryItemName\(itemNames\.get\(mapping\.inventory_item_id\)\)\s*\?\?\s*"Inventory item"/g
      ) ?? []
    ).length,
    2
  );
  assert.doesNotMatch(
    miseDomainSource,
    /itemName:\s*itemNames\.get\(mapping\.inventory_item_id\)\s*\?\?\s*"Inventory item"/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /\.map\(\(mapping\) =>\s*itemNames\.get\(mapping\.inventory_item_id\)\s*\?\?\s*"Inventory item"\)/
  );

  // Leave sibling inventory / waste / demo recipe tips alone.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationInventoryDetailItemNameIdentity/
  );
  assert.doesNotMatch(identitySource, /from ["'].*presentationWasteItemNameIdentity/);
  assert.doesNotMatch(
    identitySource,
    /from ["'].*demoRecipeBaselineIngredientEntryIdentity/
  );
  assert.doesNotMatch(identitySource, /^import /m);
  // Inventory detail title and waste unknownItem still use their own ?? paths on main.
  assert.match(
    inventoryDetailSource,
    /item\?\.item_name \?\? t\("inventory\.detail\.title"\)/
  );
  assert.match(wasteSource, /event\.itemName \?\? t\("waste\.event\.unknownItem"\)/);
  // Settings Recipes still renders the summary ingredient.itemName verbatim.
  assert.match(recipesSettingsSource, /\{ingredient\.itemName\}/);
});

test("ASCII C prep keeps ordinary recipe-baseline inventory itemName stable", () => {
  assert.equal(asciiTrimRecipeBaselineInventoryItemName(`  ${inventoryLabel}  `), inventoryLabel);
  assert.equal(asciiTrimRecipeBaselineInventoryItemName(`\t${inventoryLabel}\n`), inventoryLabel);
  assert.equal(canonicalizeRecipeBaselineInventoryItemName(`  ${inventoryLabel}  `), inventoryLabel);
  assert.equal(normalizeRecipeBaselineInventoryItemName(`  ${inventoryLabel}  `), inventoryLabel);
  assert.equal(normalizeRecipeBaselineInventoryItemName(accentedInventory), accentedInventory);
});

test("Unicode-only space and empty string bypass Inventory item via ?? until ASCII C soft-null restores it", () => {
  const emOnly = em;
  const nbspOnly = nbsp;
  const paddedSpaces = "   ";
  const empty = "";

  // Prior truthy / `??` bypass proofs.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(emOnly.trim()), false);
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeRecipeBaselineInventoryItemName(emOnly), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(emOnly) ?? FALLBACK, FALLBACK);
  assert.equal(Boolean(normalizeRecipeBaselineInventoryItemName(emOnly)), false);
  assert.equal(normalizeRecipeBaselineInventoryItemName(nbspOnly), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(paddedSpaces), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(empty), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(null), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(undefined), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(null) ?? FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean recipe-baseline inventory itemName", () => {
  const emInventory = `${em}${inventoryLabel}${em}`;
  const nbspInventory = `${nbsp}${inventoryLabel}${nbsp}`;

  // Inventing proof on Unicode trim.
  assert.equal(emInventory.trim(), inventoryLabel);
  assert.equal(nbspInventory.trim(), inventoryLabel);

  // Inventory tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimRecipeBaselineInventoryItemName(emInventory), emInventory);
  assert.equal(asciiTrimRecipeBaselineInventoryItemName(nbspInventory), nbspInventory);

  // Soft-null refuses to invent clean inventory display.
  assert.equal(canonicalizeRecipeBaselineInventoryItemName(emInventory), null);
  assert.equal(canonicalizeRecipeBaselineInventoryItemName(nbspInventory), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(emInventory), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(nbspInventory), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(emInventory) ?? FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for recipe-baseline inventory itemName", () => {
  assert.equal(normalizeRecipeBaselineInventoryItemName(`${inventoryLabel}\u0000`), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(`\u0007${inventoryLabel}`), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(`${inventoryLabel}\u007f`), null);
  // Single-line inventory labels reject embedded LF/CR.
  assert.equal(normalizeRecipeBaselineInventoryItemName(`${inventoryLabel}\nnext`), null);
  assert.equal(normalizeRecipeBaselineInventoryItemName(`${inventoryLabel}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeRecipeBaselineInventoryItemName(`${inventoryLabel}\t`), inventoryLabel);
  assert.equal(normalizeRecipeBaselineInventoryItemName("Chicken breast"), inventoryLabel);
});

test("buildRecipeBaselineSummary fails closed on Unicode-only-space inventory item_name", () => {
  const summary = buildRecipeBaselineSummary(
    restaurantId,
    [],
    [mapping()],
    [inventoryItem({ item_name: em })],
    operatingDate
  );

  assert.equal(summary.items.length, 1);
  assert.equal(summary.items[0]?.ingredients[0]?.itemName, FALLBACK);
  assert.deepEqual(summary.items[0]?.linkedInventoryItems, [FALLBACK]);
  assert.doesNotMatch(summary.items[0]?.ingredients[0]?.itemName ?? "", new RegExp(em));
});

test("buildRecipeBaselineSummary refuses Unicode-padded inventory item_name inventing", () => {
  const padded = `${em}${inventoryLabel}${em}`;
  const summary = buildRecipeBaselineSummary(
    restaurantId,
    [],
    [mapping()],
    [inventoryItem({ item_name: padded })],
    operatingDate
  );

  assert.equal(summary.items.length, 1);
  // Fail closed to intentional fallback rather than inventing clean Chicken breast.
  assert.equal(summary.items[0]?.ingredients[0]?.itemName, FALLBACK);
  assert.deepEqual(summary.items[0]?.linkedInventoryItems, [FALLBACK]);
  assert.notEqual(padded.trim(), FALLBACK);
  assert.equal(padded.trim(), inventoryLabel);
});

test("buildRecipeBaselineSummary keeps ordinary inventory item_name and ASCII-trimmed labels", () => {
  const summary = buildRecipeBaselineSummary(
    restaurantId,
    [],
    [
      mapping(),
      mapping({
        id: "map_ascii_c_recipe_baseline_b",
        inventory_item_id: "inv_ascii_c_recipe_baseline_b",
        menu_item_name: "Crème Bowl"
      })
    ],
    [
      inventoryItem({ item_name: `  ${inventoryLabel}  ` }),
      inventoryItem({
        id: "inv_ascii_c_recipe_baseline_b",
        item_name: accentedInventory
      })
    ],
    operatingDate
  );

  assert.equal(summary.items.length, 2);
  const byMenu = new Map(summary.items.map((item) => [item.menu_item_name, item]));
  assert.equal(byMenu.get("Chicken Bowl")?.ingredients[0]?.itemName, inventoryLabel);
  assert.deepEqual(byMenu.get("Chicken Bowl")?.linkedInventoryItems, [inventoryLabel]);
  assert.equal(byMenu.get("Crème Bowl")?.ingredients[0]?.itemName, accentedInventory);
  assert.deepEqual(byMenu.get("Crème Bowl")?.linkedInventoryItems, [accentedInventory]);
});
