import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSettingsWorkspaceCuisine,
  canonicalizeSettingsWorkspaceCuisine,
  normalizeSettingsWorkspaceCuisine
} from "../services/domain/presentationSettingsWorkspaceCuisineIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSettingsWorkspaceCuisineIdentity.ts", import.meta.url),
  "utf8"
);
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");

const cuisine = "Coastal Seafood";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VO pins Settings workspace cuisine_type to ASCII C", () => {
  assert.match(identitySource, /MISE-005VO/);
  assert.match(settingsSource, /MISE-005VO/);

  assert.match(
    identitySource,
    /export function asciiTrimSettingsWorkspaceCuisine\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    settingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSettingsWorkspaceCuisineIdentity"/
  );
  assert.match(settingsSource, /normalizeSettingsWorkspaceCuisine\(/);
  assert.match(
    settingsSource,
    /normalizeSettingsWorkspaceCuisine\(item\.cuisine_type\) \|\|\s*t\("settings\.workspace\.metaFallback"\)/
  );
  assert.doesNotMatch(
    settingsSource,
    /item\.cuisine_type \?\? t\("settings\.workspace\.metaFallback"\)/
  );

  // Leave sibling workspace copy and unrelated presentation tips alone.
  assert.match(settingsSource, /styles\.workspaceName/);
  assert.match(settingsSource, /\{item\.name\}/);
  assert.match(settingsSource, /settings\.workspace\.currentAccessibility/);
  assert.match(settingsSource, /settings\.workspace\.switchAccessibility/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationSalesImportRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Settings workspace cuisine labels stable", () => {
  assert.equal(asciiTrimSettingsWorkspaceCuisine(`  ${cuisine}  `), cuisine);
  assert.equal(asciiTrimSettingsWorkspaceCuisine(`\t${cuisine}\n`), cuisine);
  assert.equal(canonicalizeSettingsWorkspaceCuisine(`  ${cuisine}  `), cuisine);
  assert.equal(normalizeSettingsWorkspaceCuisine(`  ${cuisine}  `), cuisine);
  assert.equal(normalizeSettingsWorkspaceCuisine("Italian"), "Italian");
});

test("Unicode-only space cannot bypass the localized Settings workspace metaFallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior `??` row with a typed nullable candidate so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorDisplay = (value: string | null | undefined) => value ?? "FALLBACK";

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized metaFallback.
  assert.equal(normalizeSettingsWorkspaceCuisine(unicodeOnly), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(nbspOnly), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsWorkspaceCuisine("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsWorkspaceCuisine(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Settings workspace cuisine labels", () => {
  const padded = `${em}${cuisine}${em}`;
  const nbspCuisine = `${nbsp}${cuisine}${nbsp}`;
  const internalEm = `Coastal${em}Seafood`;
  const internalNbsp = `Coastal${nbsp}Seafood`;

  // Inventing proof: Unicode trim would invent the clean cuisine label.
  assert.equal(padded.trim(), cuisine);
  assert.equal(nbspCuisine.trim(), cuisine);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspCuisine), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSettingsWorkspaceCuisine(padded), padded);
  assert.equal(canonicalizeSettingsWorkspaceCuisine(padded), null);
  assert.equal(canonicalizeSettingsWorkspaceCuisine(nbspCuisine), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(padded), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(nbspCuisine), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSettingsWorkspaceCuisine(internalEm), internalEm);
  assert.equal(normalizeSettingsWorkspaceCuisine(internalNbsp), internalNbsp);
  assert.equal(normalizeSettingsWorkspaceCuisine(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings workspace cuisine", () => {
  assert.equal(normalizeSettingsWorkspaceCuisine(undefined), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(null), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(""), null);
  assert.equal(normalizeSettingsWorkspaceCuisine("   "), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(123 as unknown as string), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(`\u0001${cuisine}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSettingsWorkspaceCuisine(`${cuisine}\t`), cuisine);
  assert.equal(normalizeSettingsWorkspaceCuisine(`${cuisine}\u0007`), null);
  assert.equal(normalizeSettingsWorkspaceCuisine(em), null);
});
