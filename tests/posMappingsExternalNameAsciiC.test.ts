import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingsExternalName,
  canonicalizePosMappingsExternalName,
  normalizePosMappingsExternalName
} from "../services/domain/presentationPosMappingsExternalNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationPosMappingsExternalNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const posMappingsSource = readFileSync(
  new URL("../app/settings/pos-mappings.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const menuItemNameIdentityPath = new URL(
  "../services/domain/presentationPosMappingsMenuItemNameIdentity.ts",
  import.meta.url
);
const choiceListNameIdentityPath = new URL(
  "../services/domain/presentationPosMappingsChoiceListMenuItemNameIdentity.ts",
  import.meta.url
);
const choiceListCategoryIdentityPath = new URL(
  "../services/domain/presentationPosMappingsChoiceListCategoryIdentity.ts",
  import.meta.url
);
const squareCatalogExternalNameIdentityPath = new URL(
  "../services/domain/squareCatalogItemExternalNameIdentity.ts",
  import.meta.url
);

const externalName = "Square Burger";
const accentedName = "Café Latte";
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

test("MISE-005ABE pins POS mappings card-header externalName to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABE/);
  assert.match(posMappingsSource, /MISE-005ABE/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingsExternalName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosMappingsExternalName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posMappingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosMappingsExternalNameIdentity"/
  );
  assert.match(posMappingsSource, /normalizePosMappingsExternalName\(/);
  assert.match(
    posMappingsSource,
    /const mappingExternalName = normalizePosMappingsExternalName\(\s*mapping\.externalName\s*\)/
  );
  assert.match(
    posMappingsSource,
    /\{mappingExternalName \|\| t\("common\.none"\)\}/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /<Text style=\{styles\.mappingName\}>\{mapping\.externalName\}<\/Text>/
  );

  // Bypass proof: repository requiredPosMappingString accepts length ≥ 1,
  // so Unicode-only-space external names survive into always-pass chrome.
  assert.match(
    repositorySource,
    /externalName: requiredPosMappingString\(row, "externalName", 240\)/
  );
  assert.match(
    repositorySource,
    /if \(typeof value !== "string" \|\| value\.length < 1 \|\| value\.length > maximumLength\)/
  );

  assert.match(catalogSource, /"common\.none": "None"/);
  assert.match(catalogSource, /"common\.none": "Ninguno"/);
  assert.match(catalogSource, /"common\.none": "无"/);

  // Leave locationName, suggestion/selected names (#1024), and choice-list
  // name/category (#1207 / #1206) alone on this tip.
  assert.match(
    posMappingsSource,
    /<Text style=\{styles\.location\}>\{mapping\.locationName\}<\/Text>/
  );
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
    /<Text style=\{styles\.choiceValue\}>\{menuItem\.name\}<\/Text>/
  );
  assert.match(
    posMappingsSource,
    /\{menuItem\.category \? <Text style=\{styles\.mappingMeta\}>\{menuItem\.category\}<\/Text> : null\}/
  );
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsMenuItemName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListMenuItemName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListCategory/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsLocationName\b/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(
    identitySource,
    /presentationPosMappingsChoiceListMenuItemNameIdentity/
  );
  assert.doesNotMatch(identitySource, /presentationPosMappingsChoiceListCategoryIdentity/);
  assert.doesNotMatch(identitySource, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(menuItemNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListCategoryIdentityPath), "absent");
  assert.equal(filePresence(squareCatalogExternalNameIdentityPath), "absent");
});

test("ASCII C prep keeps ordinary POS mappings card-header external names stable", () => {
  assert.equal(asciiTrimPosMappingsExternalName(`  ${externalName}  `), externalName);
  assert.equal(asciiTrimPosMappingsExternalName(`\t${externalName}\n`), externalName);
  assert.equal(canonicalizePosMappingsExternalName(`  ${externalName}  `), externalName);
  assert.equal(normalizePosMappingsExternalName(`  ${externalName}  `), externalName);
  assert.equal(normalizePosMappingsExternalName(accentedName), accentedName);
  assert.equal(normalizePosMappingsExternalName("宫保鸡丁"), "宫保鸡丁");
  assert.equal(normalizePosMappingsExternalName("Soup of the Day"), "Soup of the Day");
});

test("Unicode-only space cannot bypass POS mappings card-header externalName none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Bypass proof: always-pass chrome previously rendered blank-looking names.
  // requiredPosMappingString accepts length ≥ 1, so Unicode-only space survives.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(empty), false);
  assert.equal(unicodeOnly.length >= 1, true);
  assert.notEqual(unicodeOnly.trim(), unicodeOnly);
  assert.equal(unicodeOnly.trim(), "");

  // Soft-null restores the intentional localized common.none path.
  assert.equal(normalizePosMappingsExternalName(unicodeOnly), null);
  assert.equal(normalizePosMappingsExternalName(nbspOnly), null);
  assert.equal(normalizePosMappingsExternalName(empty), null);
  assert.equal(normalizePosMappingsExternalName("   "), null);
  assert.equal(normalizePosMappingsExternalName(unicodeOnly) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean POS mappings card-header external names", () => {
  const padded = `${em}${externalName}${em}`;
  const nbspName = `${nbsp}${externalName}${nbsp}`;
  const internalEm = `Square${em}Burger`;
  const internalNbsp = `Square${nbsp}Burger`;

  // Inventing proof: Unicode trim would invent the clean external name.
  assert.equal(padded.trim(), externalName);
  assert.equal(nbspName.trim(), externalName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosMappingsExternalName(padded), padded);
  assert.equal(canonicalizePosMappingsExternalName(padded), null);
  assert.equal(canonicalizePosMappingsExternalName(nbspName), null);
  assert.equal(normalizePosMappingsExternalName(padded), null);
  assert.equal(normalizePosMappingsExternalName(nbspName), null);
  assert.equal(normalizePosMappingsExternalName(padded) || "FALLBACK", "FALLBACK");

  // Sibling locationName is left raw on this tip — inventing proof stays
  // scoped to externalName identity helpers only.
  assert.equal(normalizePosMappingsExternalName(padded), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosMappingsExternalName(internalEm), internalEm);
  assert.equal(normalizePosMappingsExternalName(internalNbsp), internalNbsp);
  assert.equal(normalizePosMappingsExternalName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS mappings card-header external names", () => {
  assert.equal(normalizePosMappingsExternalName(undefined), null);
  assert.equal(normalizePosMappingsExternalName(null), null);
  assert.equal(normalizePosMappingsExternalName(""), null);
  assert.equal(normalizePosMappingsExternalName("   "), null);
  assert.equal(normalizePosMappingsExternalName(123 as unknown as string), null);
  assert.equal(normalizePosMappingsExternalName(`\u0001${externalName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosMappingsExternalName(`${externalName}\t`), externalName);
  assert.equal(normalizePosMappingsExternalName(`${externalName}\u0007`), null);
  assert.equal(normalizePosMappingsExternalName(em), null);
});
