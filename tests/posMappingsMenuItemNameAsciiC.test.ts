import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingsMenuItemName,
  canonicalizePosMappingsMenuItemName,
  normalizePosMappingsMenuItemName
} from "../services/domain/presentationPosMappingsMenuItemNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationPosMappingsMenuItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const posMappingsSource = readFileSync(
  new URL("../app/settings/pos-mappings.tsx", import.meta.url),
  "utf8"
);

const menuItemName = "Classic Burger";
const accentedMenuItemName = "Café Latte";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VP pins POS mappings menu-item names to ASCII C", () => {
  assert.match(identitySource, /MISE-005VP/);
  assert.match(posMappingsSource, /MISE-005VP/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingsMenuItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosMappingsMenuItemName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posMappingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosMappingsMenuItemNameIdentity"/
  );
  assert.match(
    posMappingsSource,
    /normalizePosMappingsMenuItemName\(mapping\.suggestedMenuItemName\)\s*\|\|\s*t\("common\.none"\)/
  );
  assert.match(
    posMappingsSource,
    /normalizePosMappingsMenuItemName\(selectedMenuItem\?\.name\)\s*\|\|\s*t\("pos\.mappings\.chooseItem"\)/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /mapping\.suggestedMenuItemName \?\? t\("common\.none"\)/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /selectedMenuItem\?\.name \?\? t\("pos\.mappings\.chooseItem"\)/
  );

  // Leave choice-list menuItem.name pass-through alone (no inventing/?? path).
  assert.match(posMappingsSource, /\{menuItem\.name\}/);
  assert.match(posMappingsSource, /mapping\.externalName/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationSettingsWorkspaceCuisineIdentity/);
  assert.doesNotMatch(identityCode, /presentationSalesImportRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationOrdersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary POS mappings menu-item names stable", () => {
  assert.equal(asciiTrimPosMappingsMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(asciiTrimPosMappingsMenuItemName(`\t${menuItemName}\n`), menuItemName);
  assert.equal(canonicalizePosMappingsMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(normalizePosMappingsMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(normalizePosMappingsMenuItemName(accentedMenuItemName), accentedMenuItemName);
  assert.equal(normalizePosMappingsMenuItemName("House Salad"), "House Salad");
});

test("Unicode-only space cannot bypass localized POS mappings fallbacks", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior `??` rows with a typed nullable candidate so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorSuggested = (value: string | null | undefined) => value ?? "NONE";
  const priorSelected = (value: string | null | undefined) => value ?? "CHOOSE";

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback.
  assert.equal(priorSuggested(unicodeOnly), unicodeOnly);
  assert.equal(priorSuggested(nbspOnly), nbspOnly);
  assert.equal(priorSuggested(empty), empty);
  assert.equal(priorSelected(unicodeOnly), unicodeOnly);
  assert.notEqual(priorSuggested(unicodeOnly), "NONE");
  assert.notEqual(priorSelected(empty), "CHOOSE");

  // Soft-null restores the intentional localized fallbacks.
  assert.equal(normalizePosMappingsMenuItemName(unicodeOnly), null);
  assert.equal(normalizePosMappingsMenuItemName(nbspOnly), null);
  assert.equal(normalizePosMappingsMenuItemName(unicodeOnly) || "NONE", "NONE");
  assert.equal(normalizePosMappingsMenuItemName(unicodeOnly) || "CHOOSE", "CHOOSE");
  assert.equal(normalizePosMappingsMenuItemName("   ") || "NONE", "NONE");
  assert.equal(normalizePosMappingsMenuItemName(empty) || "CHOOSE", "CHOOSE");
});

test("Unicode em-space / NBSP padding cannot invent clean POS mappings menu-item names", () => {
  const padded = `${em}${menuItemName}${em}`;
  const nbspName = `${nbsp}${menuItemName}${nbsp}`;
  const internalEm = `Classic${em}Burger`;
  const internalNbsp = `Classic${nbsp}Burger`;

  // Inventing proof: Unicode trim would invent the clean menu-item name.
  assert.equal(padded.trim(), menuItemName);
  assert.equal(nbspName.trim(), menuItemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosMappingsMenuItemName(padded), padded);
  assert.equal(canonicalizePosMappingsMenuItemName(padded), null);
  assert.equal(canonicalizePosMappingsMenuItemName(nbspName), null);
  assert.equal(normalizePosMappingsMenuItemName(padded), null);
  assert.equal(normalizePosMappingsMenuItemName(nbspName), null);
  assert.equal(normalizePosMappingsMenuItemName(padded) || "NONE", "NONE");
  assert.equal(normalizePosMappingsMenuItemName(padded) || "CHOOSE", "CHOOSE");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosMappingsMenuItemName(internalEm), internalEm);
  assert.equal(normalizePosMappingsMenuItemName(internalNbsp), internalNbsp);
  assert.equal(normalizePosMappingsMenuItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS mappings menu-item names", () => {
  assert.equal(normalizePosMappingsMenuItemName(undefined), null);
  assert.equal(normalizePosMappingsMenuItemName(null), null);
  assert.equal(normalizePosMappingsMenuItemName(""), null);
  assert.equal(normalizePosMappingsMenuItemName("   "), null);
  assert.equal(normalizePosMappingsMenuItemName(123 as unknown as string), null);
  assert.equal(normalizePosMappingsMenuItemName(`\u0001${menuItemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosMappingsMenuItemName(`${menuItemName}\t`), menuItemName);
  assert.equal(normalizePosMappingsMenuItemName(`${menuItemName}\u0007`), null);
  assert.equal(normalizePosMappingsMenuItemName(em), null);
});
