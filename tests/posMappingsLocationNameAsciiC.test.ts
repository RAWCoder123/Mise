import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingsLocationName,
  canonicalizePosMappingsLocationName,
  normalizePosMappingsLocationName
} from "../services/domain/presentationPosMappingsLocationNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationPosMappingsLocationNameIdentity.ts",
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

const externalNameIdentityPath = new URL(
  "../services/domain/presentationPosMappingsExternalNameIdentity.ts",
  import.meta.url
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

const locationName = "Main Counter";
const accentedName = "Café Patio";
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

test("MISE-005ABF pins POS mappings card-header locationName to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABF/);
  assert.match(posMappingsSource, /MISE-005ABF/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingsLocationName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosMappingsLocationName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posMappingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosMappingsLocationNameIdentity"/
  );
  assert.match(posMappingsSource, /normalizePosMappingsLocationName\(/);
  assert.match(
    posMappingsSource,
    /const mappingLocationName = normalizePosMappingsLocationName\(\s*mapping\.locationName\s*\)/
  );
  assert.match(
    posMappingsSource,
    /\{mappingLocationName \|\| t\("common\.none"\)\}/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /<Text style=\{styles\.location\}>\{mapping\.locationName\}<\/Text>/
  );

  // Bypass proof: repository requiredPosMappingString accepts length ≥ 1,
  // so Unicode-only-space location names survive into always-pass chrome.
  assert.match(
    repositorySource,
    /locationName: requiredPosMappingString\(row, "locationName", 160\)/
  );
  assert.match(
    repositorySource,
    /if \(typeof value !== "string" \|\| value\.length < 1 \|\| value\.length > maximumLength\)/
  );

  assert.match(catalogSource, /"common\.none": "None"/);
  assert.match(catalogSource, /"common\.none": "Ninguno"/);
  assert.match(catalogSource, /"common\.none": "无"/);

  // Leave externalName, suggestion/selected names (#1024), and choice-list
  // name/category (#1207 / #1206) alone on this tip.
  assert.match(
    posMappingsSource,
    /<Text style=\{styles\.mappingName\}>\{mapping\.externalName\}<\/Text>/
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
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsExternalName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsMenuItemName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListMenuItemName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListCategory/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsExternalNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(
    identitySource,
    /presentationPosMappingsChoiceListMenuItemNameIdentity/
  );
  assert.doesNotMatch(identitySource, /presentationPosMappingsChoiceListCategoryIdentity/);
  assert.doesNotMatch(identitySource, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(externalNameIdentityPath), "absent");
  assert.equal(filePresence(menuItemNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListCategoryIdentityPath), "absent");
  assert.equal(filePresence(squareCatalogExternalNameIdentityPath), "absent");
});

test("ASCII C prep keeps ordinary POS mappings card-header location names stable", () => {
  assert.equal(asciiTrimPosMappingsLocationName(`  ${locationName}  `), locationName);
  assert.equal(asciiTrimPosMappingsLocationName(`\t${locationName}\n`), locationName);
  assert.equal(canonicalizePosMappingsLocationName(`  ${locationName}  `), locationName);
  assert.equal(normalizePosMappingsLocationName(`  ${locationName}  `), locationName);
  assert.equal(normalizePosMappingsLocationName(accentedName), accentedName);
  assert.equal(normalizePosMappingsLocationName("前台"), "前台");
  assert.equal(normalizePosMappingsLocationName("Patio Bar"), "Patio Bar");
});

test("Unicode-only space cannot bypass POS mappings card-header locationName none fallback", () => {
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
  assert.equal(normalizePosMappingsLocationName(unicodeOnly), null);
  assert.equal(normalizePosMappingsLocationName(nbspOnly), null);
  assert.equal(normalizePosMappingsLocationName(empty), null);
  assert.equal(normalizePosMappingsLocationName("   "), null);
  assert.equal(normalizePosMappingsLocationName(unicodeOnly) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean POS mappings card-header location names", () => {
  const padded = `${em}${locationName}${em}`;
  const nbspName = `${nbsp}${locationName}${nbsp}`;
  const internalEm = `Main${em}Counter`;
  const internalNbsp = `Main${nbsp}Counter`;

  // Inventing proof: Unicode trim would invent the clean location name.
  assert.equal(padded.trim(), locationName);
  assert.equal(nbspName.trim(), locationName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosMappingsLocationName(padded), padded);
  assert.equal(canonicalizePosMappingsLocationName(padded), null);
  assert.equal(canonicalizePosMappingsLocationName(nbspName), null);
  assert.equal(normalizePosMappingsLocationName(padded), null);
  assert.equal(normalizePosMappingsLocationName(nbspName), null);
  assert.equal(normalizePosMappingsLocationName(padded) || "FALLBACK", "FALLBACK");

  // Sibling externalName is left raw on this tip — inventing proof stays
  // scoped to locationName identity helpers only.
  assert.equal(normalizePosMappingsLocationName(padded), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosMappingsLocationName(internalEm), internalEm);
  assert.equal(normalizePosMappingsLocationName(internalNbsp), internalNbsp);
  assert.equal(normalizePosMappingsLocationName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS mappings card-header location names", () => {
  assert.equal(normalizePosMappingsLocationName(undefined), null);
  assert.equal(normalizePosMappingsLocationName(null), null);
  assert.equal(normalizePosMappingsLocationName(""), null);
  assert.equal(normalizePosMappingsLocationName("   "), null);
  assert.equal(normalizePosMappingsLocationName(123 as unknown as string), null);
  assert.equal(normalizePosMappingsLocationName(`\u0001${locationName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosMappingsLocationName(`${locationName}\t`), locationName);
  assert.equal(normalizePosMappingsLocationName(`${locationName}\u0007`), null);
  assert.equal(normalizePosMappingsLocationName(em), null);
});
