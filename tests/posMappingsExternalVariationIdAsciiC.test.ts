import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingsExternalVariationId,
  canonicalizePosMappingsExternalVariationId,
  normalizePosMappingsExternalVariationId
} from "../services/domain/presentationPosMappingsExternalVariationIdIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationPosMappingsExternalVariationIdIdentity.ts",
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
const locationNameIdentityPath = new URL(
  "../services/domain/presentationPosMappingsLocationNameIdentity.ts",
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

const variationId = "VAR-A";
const accentedId = "VAR-Café";
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

test("MISE-005ABJ pins POS mappings card-meta externalVariationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABJ/);
  assert.match(posMappingsSource, /MISE-005ABJ/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingsExternalVariationId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line variation-id tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosMappingsExternalVariationId("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posMappingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosMappingsExternalVariationIdIdentity"/
  );
  assert.match(posMappingsSource, /normalizePosMappingsExternalVariationId\(/);
  assert.match(
    posMappingsSource,
    /const mappingExternalVariationId = normalizePosMappingsExternalVariationId\(\s*mapping\.externalVariationId\s*\)/
  );
  assert.match(
    posMappingsSource,
    /mappingExternalVariationId\s*\?\s*t\("pos\.mappings\.variation", \{ value: mappingExternalVariationId \}\)\s*:\s*t\("pos\.mappings\.variation\.none"\)/
  );
  assert.doesNotMatch(
    posMappingsSource,
    /t\("pos\.mappings\.variation", \{ value: mapping\.externalVariationId \}\)/
  );

  // Bypass proof: repository requiredPosMappingString accepts length ≥ 1,
  // so Unicode-only-space variation ids survive into always-pass chrome.
  assert.match(
    repositorySource,
    /externalVariationId: requiredPosMappingString\(row, "externalVariationId", 128\)/
  );
  assert.match(
    repositorySource,
    /if \(typeof value !== "string" \|\| value\.length < 1 \|\| value\.length > maximumLength\)/
  );

  assert.match(catalogSource, /"pos\.mappings\.variation\.none": "Square variation unavailable"/);
  assert.match(
    catalogSource,
    /"pos\.mappings\.variation\.none": "Variación de Square no disponible"/
  );
  assert.match(catalogSource, /"pos\.mappings\.variation\.none": "Square 变体不可用"/);

  // Leave locationName / externalName / suggestion / choice-list alone on this tip.
  assert.match(
    posMappingsSource,
    /<Text style=\{styles\.location\}>\{mapping\.locationName\}<\/Text>/
  );
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
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsLocationName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListMenuItemName\b/);
  assert.doesNotMatch(posMappingsSource, /normalizePosMappingsChoiceListCategory/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsExternalNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationPosMappingsLocationNameIdentity/);
  assert.doesNotMatch(
    identitySource,
    /presentationPosMappingsChoiceListMenuItemNameIdentity/
  );
  assert.doesNotMatch(identitySource, /presentationPosMappingsChoiceListCategoryIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(externalNameIdentityPath), "absent");
  assert.equal(filePresence(locationNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListNameIdentityPath), "absent");
  assert.equal(filePresence(choiceListCategoryIdentityPath), "absent");
});

test("ASCII C prep keeps ordinary POS mappings card-meta external variation ids stable", () => {
  assert.equal(asciiTrimPosMappingsExternalVariationId(`  ${variationId}  `), variationId);
  assert.equal(asciiTrimPosMappingsExternalVariationId(`\t${variationId}\n`), variationId);
  assert.equal(canonicalizePosMappingsExternalVariationId(`  ${variationId}  `), variationId);
  assert.equal(normalizePosMappingsExternalVariationId(`  ${variationId}  `), variationId);
  assert.equal(normalizePosMappingsExternalVariationId(accentedId), accentedId);
  assert.equal(normalizePosMappingsExternalVariationId("变体-甲"), "变体-甲");
  assert.equal(normalizePosMappingsExternalVariationId("VAR_01"), "VAR_01");
});

test("Unicode-only space cannot bypass POS mappings card-meta externalVariationId none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Bypass proof: always-pass chrome previously rendered blank-looking variation lines.
  // requiredPosMappingString accepts length ≥ 1, so Unicode-only space survives.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(empty), false);
  assert.equal(unicodeOnly.length >= 1, true);
  assert.notEqual(unicodeOnly.trim(), unicodeOnly);
  assert.equal(unicodeOnly.trim(), "");

  // Soft-null restores the intentional localized variation.none path.
  assert.equal(normalizePosMappingsExternalVariationId(unicodeOnly), null);
  assert.equal(normalizePosMappingsExternalVariationId(nbspOnly), null);
  assert.equal(normalizePosMappingsExternalVariationId(empty), null);
  assert.equal(normalizePosMappingsExternalVariationId("   "), null);
  assert.equal(normalizePosMappingsExternalVariationId(unicodeOnly) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean POS mappings card-meta external variation ids", () => {
  const padded = `${em}${variationId}${em}`;
  const nbspId = `${nbsp}${variationId}${nbsp}`;
  const internalEm = `VAR${em}A`;
  const internalNbsp = `VAR${nbsp}A`;

  // Inventing proof: Unicode trim would invent the clean variation id.
  assert.equal(padded.trim(), variationId);
  assert.equal(nbspId.trim(), variationId);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspId), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosMappingsExternalVariationId(padded), padded);
  assert.equal(canonicalizePosMappingsExternalVariationId(padded), null);
  assert.equal(canonicalizePosMappingsExternalVariationId(nbspId), null);
  assert.equal(normalizePosMappingsExternalVariationId(padded), null);
  assert.equal(normalizePosMappingsExternalVariationId(nbspId), null);
  assert.equal(normalizePosMappingsExternalVariationId(padded) || "FALLBACK", "FALLBACK");

  // Sibling locationName / externalName are left raw on this tip — inventing
  // proof stays scoped to externalVariationId identity helpers only.
  assert.equal(normalizePosMappingsExternalVariationId(padded), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosMappingsExternalVariationId(internalEm), internalEm);
  assert.equal(normalizePosMappingsExternalVariationId(internalNbsp), internalNbsp);
  assert.equal(normalizePosMappingsExternalVariationId(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS mappings card-meta external variation ids", () => {
  assert.equal(normalizePosMappingsExternalVariationId(undefined), null);
  assert.equal(normalizePosMappingsExternalVariationId(null), null);
  assert.equal(normalizePosMappingsExternalVariationId(""), null);
  assert.equal(normalizePosMappingsExternalVariationId("   "), null);
  assert.equal(normalizePosMappingsExternalVariationId(123 as unknown as string), null);
  assert.equal(normalizePosMappingsExternalVariationId(`\u0001${variationId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosMappingsExternalVariationId(`${variationId}\t`), variationId);
  assert.equal(normalizePosMappingsExternalVariationId(`${variationId}\u0007`), null);
  assert.equal(normalizePosMappingsExternalVariationId(em), null);
});
