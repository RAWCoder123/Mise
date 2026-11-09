import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingsChoiceListCategory,
  canonicalizePosMappingsChoiceListCategory,
  normalizePosMappingsChoiceListCategory
} from "../services/domain/presentationPosMappingsChoiceListCategoryIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationPosMappingsChoiceListCategoryIdentity.ts", import.meta.url),
  "utf8"
);
const posMappingsSource = readFileSync(
  new URL("../app/settings/pos-mappings.tsx", import.meta.url),
  "utf8"
);

const menuItemNameIdentityPath = new URL(
  "../services/domain/presentationPosMappingsMenuItemNameIdentity.ts",
  import.meta.url
);
const inventoryDetailCategoryIdentityPath = new URL(
  "../services/domain/presentationInventoryDetailCategoryIdentity.ts",
  import.meta.url
);
const scanItemRowCategoryIdentityPath = new URL(
  "../services/domain/presentationScanItemRowCategoryIdentity.ts",
  import.meta.url
);

const category = "Mains";
const accentedCategory = "Entrées";
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

test("MISE-005AAU pins POS mappings choice-list category to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAU/);
  assert.match(posMappingsSource, /MISE-005AAU/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingsChoiceListCategory\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line category tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosMappingsChoiceListCategory("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posMappingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosMappingsChoiceListCategoryIdentity"/
  );
  assert.match(posMappingsSource, /normalizePosMappingsChoiceListCategory\(/);
  assert.match(
    posMappingsSource,
    /const choiceListCategory = normalizePosMappingsChoiceListCategory\(\s*menuItem\.category\s*\)/
  );
  assert.match(
    posMappingsSource,
    /\{choiceListCategory \? \(\s*<Text style=\{styles\.mappingMeta\}>\{choiceListCategory\}<\/Text>\s*\) : null\}/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /\{menuItem\.category \? <Text style=\{styles\.mappingMeta\}>\{menuItem\.category\}<\/Text> : null\}/
  );

  // Leave choice-list menuItem.name pass-through and suggestion/selected name tips alone.
  assert.match(posMappingsSource, /\{menuItem\.name\}/);
  assert.match(
    posMappingsSource,
    /mapping\.suggestedMenuItemName \?\? t\("common\.none"\)/
  );
  assert.match(
    posMappingsSource,
    /selectedMenuItem\?\.name \?\? t\("pos\.mappings\.chooseItem"\)/
  );
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsMenuItemName/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationInventoryDetailCategoryIdentity/);
  assert.doesNotMatch(identitySource, /presentationScanItemRowCategoryIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(menuItemNameIdentityPath), "absent");
  assert.equal(filePresence(inventoryDetailCategoryIdentityPath), "absent");
  assert.equal(filePresence(scanItemRowCategoryIdentityPath), "absent");
});

test("ASCII C prep keeps ordinary POS mappings choice-list categories stable", () => {
  assert.equal(asciiTrimPosMappingsChoiceListCategory(`  ${category}  `), category);
  assert.equal(asciiTrimPosMappingsChoiceListCategory(`\t${category}\n`), category);
  assert.equal(canonicalizePosMappingsChoiceListCategory(`  ${category}  `), category);
  assert.equal(normalizePosMappingsChoiceListCategory(`  ${category}  `), category);
  assert.equal(normalizePosMappingsChoiceListCategory(accentedCategory), accentedCategory);
  assert.equal(normalizePosMappingsChoiceListCategory("Sides"), "Sides");
});

test("Unicode-only space cannot bypass POS mappings choice-list category hide", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Bypass proof: truthy Unicode-only space previously rendered blank meta.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(empty), false);
  assert.notEqual(unicodeOnly.trim(), unicodeOnly);
  assert.equal(unicodeOnly.trim(), "");

  // Soft-null restores the intentional hide path.
  assert.equal(normalizePosMappingsChoiceListCategory(unicodeOnly), null);
  assert.equal(normalizePosMappingsChoiceListCategory(nbspOnly), null);
  assert.equal(normalizePosMappingsChoiceListCategory(empty), null);
  assert.equal(normalizePosMappingsChoiceListCategory("   "), null);
  assert.equal(
    normalizePosMappingsChoiceListCategory(unicodeOnly) ? "SHOWN" : "HIDDEN",
    "HIDDEN"
  );
});

test("Unicode em-space / NBSP padding cannot invent clean POS mappings choice-list categories", () => {
  const padded = `${em}${category}${em}`;
  const nbspName = `${nbsp}${category}${nbsp}`;
  const internalEm = `Mai${em}ns`;
  const internalNbsp = `Mai${nbsp}ns`;

  // Inventing proof: Unicode trim would invent the clean category.
  assert.equal(padded.trim(), category);
  assert.equal(nbspName.trim(), category);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosMappingsChoiceListCategory(padded), padded);
  assert.equal(canonicalizePosMappingsChoiceListCategory(padded), null);
  assert.equal(canonicalizePosMappingsChoiceListCategory(nbspName), null);
  assert.equal(normalizePosMappingsChoiceListCategory(padded), null);
  assert.equal(normalizePosMappingsChoiceListCategory(nbspName), null);
  assert.equal(
    normalizePosMappingsChoiceListCategory(padded) ? "SHOWN" : "HIDDEN",
    "HIDDEN"
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosMappingsChoiceListCategory(internalEm), internalEm);
  assert.equal(normalizePosMappingsChoiceListCategory(internalNbsp), internalNbsp);
  assert.equal(normalizePosMappingsChoiceListCategory(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS mappings choice-list categories", () => {
  assert.equal(normalizePosMappingsChoiceListCategory(undefined), null);
  assert.equal(normalizePosMappingsChoiceListCategory(null), null);
  assert.equal(normalizePosMappingsChoiceListCategory(""), null);
  assert.equal(normalizePosMappingsChoiceListCategory("   "), null);
  assert.equal(normalizePosMappingsChoiceListCategory(123 as unknown as string), null);
  assert.equal(normalizePosMappingsChoiceListCategory(`\u0001${category}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosMappingsChoiceListCategory(`${category}\t`), category);
  assert.equal(normalizePosMappingsChoiceListCategory(`${category}\u0007`), null);
  assert.equal(normalizePosMappingsChoiceListCategory(em), null);
});
