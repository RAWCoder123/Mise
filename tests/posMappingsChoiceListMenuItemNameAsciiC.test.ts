import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingsChoiceListMenuItemName,
  canonicalizePosMappingsChoiceListMenuItemName,
  normalizePosMappingsChoiceListMenuItemName
} from "../services/domain/presentationPosMappingsChoiceListMenuItemNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationPosMappingsChoiceListMenuItemNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const posMappingsSource = readFileSync(
  new URL("../app/settings/pos-mappings.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const menuItemNameIdentityPath = new URL(
  "../services/domain/presentationPosMappingsMenuItemNameIdentity.ts",
  import.meta.url
);
const choiceListCategoryIdentityPath = new URL(
  "../services/domain/presentationPosMappingsChoiceListCategoryIdentity.ts",
  import.meta.url
);
const insightsBestSellersItemNameIdentityPath = new URL(
  "../services/domain/presentationInsightsBestSellersItemNameIdentity.ts",
  import.meta.url
);

const menuItemName = "House Salad";
const accentedName = "Salade Verte";
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

test("MISE-005AAV pins POS mappings choice-list menuItem.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAV/);
  assert.match(posMappingsSource, /MISE-005AAV/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingsChoiceListMenuItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosMappingsChoiceListMenuItemName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posMappingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosMappingsChoiceListMenuItemNameIdentity"/
  );
  assert.match(posMappingsSource, /normalizePosMappingsChoiceListMenuItemName\(/);
  assert.match(
    posMappingsSource,
    /const choiceListName = normalizePosMappingsChoiceListMenuItemName\(\s*menuItem\.name\s*\)/
  );
  assert.match(
    posMappingsSource,
    /\{choiceListName \|\| t\("common\.none"\)\}/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /<Text style=\{styles\.choiceValue\}>\{menuItem\.name\}<\/Text>/
  );

  assert.match(catalogSource, /"common\.none": "None"/);
  assert.match(catalogSource, /"common\.none": "Ninguno"/);
  assert.match(catalogSource, /"common\.none": "无"/);

  // Leave suggestion/selected name tips (#1024) and choice-list category (#1206) alone.
  assert.match(
    posMappingsSource,
    /mapping\.suggestedMenuItemName \?\? t\("common\.none"\)/
  );
  assert.match(
    posMappingsSource,
    /selectedMenuItem\?\.name \?\? t\("pos\.mappings\.chooseItem"\)/
  );
  assert.match(
    posMappingsSource,
    /\{menuItem\.category \? <Text style=\{styles\.mappingMeta\}>\{menuItem\.category\}<\/Text> : null\}/
  );
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsMenuItemName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListCategory/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsChoiceListCategoryIdentity/);
  assert.doesNotMatch(identitySource, /presentationInsightsBestSellersItemNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(menuItemNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListCategoryIdentityPath), "absent");
  assert.equal(filePresence(insightsBestSellersItemNameIdentityPath), "absent");
});

test("ASCII C prep keeps ordinary POS mappings choice-list menu-item names stable", () => {
  assert.equal(asciiTrimPosMappingsChoiceListMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(asciiTrimPosMappingsChoiceListMenuItemName(`\t${menuItemName}\n`), menuItemName);
  assert.equal(canonicalizePosMappingsChoiceListMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(`  ${menuItemName}  `), menuItemName);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(accentedName), accentedName);
  assert.equal(normalizePosMappingsChoiceListMenuItemName("Soup of the Day"), "Soup of the Day");
});

test("Unicode-only space cannot bypass POS mappings choice-list menu-item name none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Bypass proof: always-pass chrome previously rendered blank-looking names.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(empty), false);
  assert.notEqual(unicodeOnly.trim(), unicodeOnly);
  assert.equal(unicodeOnly.trim(), "");

  // Soft-null restores the intentional localized common.none path.
  assert.equal(normalizePosMappingsChoiceListMenuItemName(unicodeOnly), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(nbspOnly), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(empty), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName("   "), null);
  assert.equal(
    normalizePosMappingsChoiceListMenuItemName(unicodeOnly) || "FALLBACK",
    "FALLBACK"
  );
});

test("Unicode em-space / NBSP padding cannot invent clean POS mappings choice-list menu-item names", () => {
  const padded = `${em}${menuItemName}${em}`;
  const nbspName = `${nbsp}${menuItemName}${nbsp}`;
  const internalEm = `House${em}Salad`;
  const internalNbsp = `House${nbsp}Salad`;

  // Inventing proof: Unicode trim would invent the clean menu-item name.
  assert.equal(padded.trim(), menuItemName);
  assert.equal(nbspName.trim(), menuItemName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosMappingsChoiceListMenuItemName(padded), padded);
  assert.equal(canonicalizePosMappingsChoiceListMenuItemName(padded), null);
  assert.equal(canonicalizePosMappingsChoiceListMenuItemName(nbspName), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(padded), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(nbspName), null);
  assert.equal(
    normalizePosMappingsChoiceListMenuItemName(padded) || "FALLBACK",
    "FALLBACK"
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosMappingsChoiceListMenuItemName(internalEm), internalEm);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(internalNbsp), internalNbsp);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS mappings choice-list menu-item names", () => {
  assert.equal(normalizePosMappingsChoiceListMenuItemName(undefined), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(null), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(""), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName("   "), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(123 as unknown as string), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(`\u0001${menuItemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosMappingsChoiceListMenuItemName(`${menuItemName}\t`), menuItemName);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(`${menuItemName}\u0007`), null);
  assert.equal(normalizePosMappingsChoiceListMenuItemName(em), null);
});
