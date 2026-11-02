import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSubtitleCuisine,
  canonicalizeInsightsSubtitleCuisine,
  normalizeInsightsSubtitleCuisine
} from "../services/domain/presentationInsightsSubtitleCuisineIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInsightsSubtitleCuisineIdentity.ts", import.meta.url),
  "utf8"
);
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");

const cuisine = "Coastal Seafood";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VU pins Insights subtitle cuisine_type to ASCII C", () => {
  assert.match(identitySource, /MISE-005VU/);
  assert.match(insightsSource, /MISE-005VU/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSubtitleCuisine\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsSubtitleCuisineIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsSubtitleCuisine\(/);
  assert.match(
    insightsSource,
    /serviceLabel \?\?\s*normalizeInsightsSubtitleCuisine\(restaurant\.cuisine_type\) \?\?\s*t\("settings\.profile\.cuisineFallback"\)/
  );
  assert.doesNotMatch(
    insightsSource,
    /serviceLabel \?\? restaurant\.cuisine_type \?\? t\("settings\.profile\.cuisineFallback"\)/
  );

  // Leave Insights profile cuisine chip on open #970 (still Unicode-trim on main).
  assert.match(
    insightsSource,
    /cuisineType\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );

  // Leave Insights profile restaurant-name chip on open #969.
  assert.match(
    insightsSource,
    /restaurantName\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );

  // Leave Settings workspace cuisine meta on open #1023 (still ?? on main).
  assert.match(
    settingsSource,
    /item\.cuisine_type \?\? t\("settings\.workspace\.metaFallback"\)/
  );

  // Leave subtitle restaurant.name pass-through alone.
  assert.match(insightsSource, /restaurant: restaurant\.name/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsProfileCuisineTypeIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsWorkspaceCuisineIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Insights subtitle cuisine labels stable", () => {
  assert.equal(asciiTrimInsightsSubtitleCuisine(`  ${cuisine}  `), cuisine);
  assert.equal(asciiTrimInsightsSubtitleCuisine(`\t${cuisine}\n`), cuisine);
  assert.equal(canonicalizeInsightsSubtitleCuisine(`  ${cuisine}  `), cuisine);
  assert.equal(normalizeInsightsSubtitleCuisine(`  ${cuisine}  `), cuisine);
  assert.equal(normalizeInsightsSubtitleCuisine("Italian"), "Italian");
});

test("Unicode-only space cannot bypass the localized Insights subtitle cuisineFallback", () => {
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

  // Soft-null restores the intentional localized cuisineFallback.
  assert.equal(normalizeInsightsSubtitleCuisine(unicodeOnly), null);
  assert.equal(normalizeInsightsSubtitleCuisine(nbspOnly), null);
  assert.equal(normalizeInsightsSubtitleCuisine(unicodeOnly) ?? "FALLBACK", "FALLBACK");
  assert.equal(normalizeInsightsSubtitleCuisine("   ") ?? "FALLBACK", "FALLBACK");
  assert.equal(normalizeInsightsSubtitleCuisine(empty) ?? "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Insights subtitle cuisine labels", () => {
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
  assert.equal(asciiTrimInsightsSubtitleCuisine(padded), padded);
  assert.equal(canonicalizeInsightsSubtitleCuisine(padded), null);
  assert.equal(canonicalizeInsightsSubtitleCuisine(nbspCuisine), null);
  assert.equal(normalizeInsightsSubtitleCuisine(padded), null);
  assert.equal(normalizeInsightsSubtitleCuisine(nbspCuisine), null);
  assert.equal(normalizeInsightsSubtitleCuisine(padded) ?? "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsSubtitleCuisine(internalEm), internalEm);
  assert.equal(normalizeInsightsSubtitleCuisine(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsSubtitleCuisine(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights subtitle cuisine", () => {
  assert.equal(normalizeInsightsSubtitleCuisine(undefined), null);
  assert.equal(normalizeInsightsSubtitleCuisine(null), null);
  assert.equal(normalizeInsightsSubtitleCuisine(""), null);
  assert.equal(normalizeInsightsSubtitleCuisine("   "), null);
  assert.equal(normalizeInsightsSubtitleCuisine(123 as unknown as string), null);
  assert.equal(normalizeInsightsSubtitleCuisine(`\u0001${cuisine}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsSubtitleCuisine(`${cuisine}\t`), cuisine);
  assert.equal(normalizeInsightsSubtitleCuisine(`${cuisine}\u0007`), null);
  assert.equal(normalizeInsightsSubtitleCuisine(em), null);
});
