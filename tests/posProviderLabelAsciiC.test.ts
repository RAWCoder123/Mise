import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosProviderLabel,
  canonicalizePosProviderLabel,
  normalizePosProviderLabel
} from "../services/domain/presentationPosProviderLabelIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationPosProviderLabelIdentity.ts", import.meta.url),
  "utf8"
);
const posUiSource = readFileSync(new URL("../app/settings/pos.tsx", import.meta.url), "utf8");
const posMappingsSource = readFileSync(
  new URL("../app/settings/pos-mappings.tsx", import.meta.url),
  "utf8"
);

const provider = "Square";
const accentedProvider = "Café POS";
const em = "\u2003";
const nbsp = "\u00a0";
const DEMO_FALLBACK = "Demo";
const NONE_FALLBACK = "None";

test("MISE-005VV pins POS settings posProviderLabel to ASCII C", () => {
  assert.match(identitySource, /MISE-005VV/);
  assert.match(posUiSource, /MISE-005VV/);

  assert.match(
    identitySource,
    /export function asciiTrimPosProviderLabel\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line provider tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimPosProviderLabel("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    posUiSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPosProviderLabelIdentity"/
  );
  assert.match(posUiSource, /normalizePosProviderLabel\(/);
  assert.match(
    posUiSource,
    /normalizePosProviderLabel\(\s*posProvider === "Manual CSV Upload" \? t\("pos\.provider\.manualCsv"\) : posProvider\s*\)/
  );
  assert.match(posUiSource, /posProviderLabel \|\| t\("common\.demo"\)/);
  assert.match(posUiSource, /posProviderLabel \|\| t\("common\.none"\)/);
  assert.doesNotMatch(posUiSource, /posProviderLabel \?\? t\("common\.demo"\)/);
  assert.doesNotMatch(posUiSource, /posProviderLabel \?\? t\("common\.none"\)/);

  // Leave POS mappings menu-item name tips on open #1024 (still ?? on main).
  assert.match(
    posMappingsSource,
    /mapping\.suggestedMenuItemName \?\? t\("common\.none"\)/
  );
  assert.match(
    posMappingsSource,
    /selectedMenuItem\?\.name \?\? t\("pos\.mappings\.chooseItem"\)/
  );

  // Leave raw posProvider tone/stats selection alone.
  assert.match(posUiSource, /tone=\{isDemoMode \? \(posProvider \? "leaf" : "caution"\)/);
  assert.match(
    posUiSource,
    /value: isDemoMode\s*\?\s*posProvider\s*\?\s*t\("common\.on"\)\s*:\s*t\("common\.none"\)/
  );

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationPosMappingsMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsWorkspaceCuisineIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleCuisineIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationGmailSenderEmailIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary POS provider labels stable", () => {
  assert.equal(asciiTrimPosProviderLabel(`  ${provider}  `), provider);
  assert.equal(asciiTrimPosProviderLabel(`\t${provider}\n`), provider);
  assert.equal(canonicalizePosProviderLabel(`  ${provider}  `), provider);
  assert.equal(normalizePosProviderLabel(`  ${provider}  `), provider);
  assert.equal(normalizePosProviderLabel(accentedProvider), accentedProvider);
  assert.equal(normalizePosProviderLabel("Manual CSV Upload"), "Manual CSV Upload");
});

test("Unicode-only space and empty string bypass common.demo / common.none via ?? until ASCII C soft-null restores them", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior `??` row with a typed nullable candidate so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorDisplay = (value: string | null | undefined) => value ?? DEMO_FALLBACK;

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.notEqual(priorDisplay(unicodeOnly), DEMO_FALLBACK);
  assert.notEqual(priorDisplay(empty), DEMO_FALLBACK);
  assert.equal(Boolean(unicodeOnly), true);

  // Soft-null restores the intentional localized common.demo / common.none.
  assert.equal(normalizePosProviderLabel(unicodeOnly), null);
  assert.equal(normalizePosProviderLabel(nbspOnly), null);
  assert.equal(normalizePosProviderLabel(unicodeOnly) || DEMO_FALLBACK, DEMO_FALLBACK);
  assert.equal(normalizePosProviderLabel(unicodeOnly) || NONE_FALLBACK, NONE_FALLBACK);
  assert.equal(normalizePosProviderLabel("   ") || DEMO_FALLBACK, DEMO_FALLBACK);
  assert.equal(normalizePosProviderLabel(empty) || DEMO_FALLBACK, DEMO_FALLBACK);
  assert.equal(normalizePosProviderLabel(null) || DEMO_FALLBACK, DEMO_FALLBACK);
  assert.equal(normalizePosProviderLabel(undefined) || NONE_FALLBACK, NONE_FALLBACK);
});

test("Unicode em-space / NBSP padding cannot invent clean POS provider labels", () => {
  const padded = `${em}${provider}${em}`;
  const nbspProvider = `${nbsp}${provider}${nbsp}`;
  const internalEm = `Squ${em}are`;
  const internalNbsp = `Squ${nbsp}are`;

  // Inventing proof: Unicode trim would invent the clean provider label.
  assert.equal(padded.trim(), provider);
  assert.equal(nbspProvider.trim(), provider);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspProvider), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimPosProviderLabel(padded), padded);
  assert.equal(canonicalizePosProviderLabel(padded), null);
  assert.equal(canonicalizePosProviderLabel(nbspProvider), null);
  assert.equal(normalizePosProviderLabel(padded), null);
  assert.equal(normalizePosProviderLabel(nbspProvider), null);
  assert.equal(normalizePosProviderLabel(padded) || DEMO_FALLBACK, DEMO_FALLBACK);
  assert.equal(normalizePosProviderLabel(nbspProvider) || NONE_FALLBACK, NONE_FALLBACK);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePosProviderLabel(internalEm), internalEm);
  assert.equal(normalizePosProviderLabel(internalNbsp), internalNbsp);
  assert.equal(normalizePosProviderLabel(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for POS provider labels", () => {
  assert.equal(normalizePosProviderLabel(undefined), null);
  assert.equal(normalizePosProviderLabel(null), null);
  assert.equal(normalizePosProviderLabel(""), null);
  assert.equal(normalizePosProviderLabel("   "), null);
  assert.equal(normalizePosProviderLabel(123 as unknown as string), null);
  assert.equal(normalizePosProviderLabel(`\u0001${provider}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePosProviderLabel(`${provider}\t`), provider);
  assert.equal(normalizePosProviderLabel(`${provider}\u0007`), null);
  assert.equal(normalizePosProviderLabel(`${provider}\nnext`), null);
  assert.equal(normalizePosProviderLabel(`${provider}\rmore`), null);
  assert.equal(normalizePosProviderLabel(em), null);
});
