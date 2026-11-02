import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsSubtitleRestaurantName,
  canonicalizeInsightsSubtitleRestaurantName,
  normalizeInsightsSubtitleRestaurantName
} from "../services/domain/presentationInsightsSubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInsightsSubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const salesImportSource = readFileSync(
  new URL("../app/settings/sales-import.tsx", import.meta.url),
  "utf8"
);
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WC pins Insights subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WC/);
  assert.match(insightsSource, /MISE-005WC/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsSubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsSubtitleRestaurantNameIdentity"/
  );
  assert.match(insightsSource, /normalizeInsightsSubtitleRestaurantName\(/);
  assert.match(
    insightsSource,
    /restaurant && insightsSubtitleRestaurantName\s*\?\s*t\("insights\.subtitleRestaurantStyle"/
  );
  assert.match(
    insightsSource,
    /restaurant: insightsSubtitleRestaurantName/
  );
  assert.doesNotMatch(
    insightsSource,
    /restaurant: restaurant\.name/
  );

  // Leave Insights profile restaurant-name chip on open #969 (still Unicode-trim on main).
  assert.match(
    insightsSource,
    /restaurantName\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );

  // Leave Insights subtitle cuisine_type on open #1029 (still ?? on main).
  assert.match(
    insightsSource,
    /serviceLabel \?\? restaurant\.cuisine_type \?\? t\("settings\.profile\.cuisineFallback"\)/
  );

  // Leave Settings profile restaurant-name tip path on open #1021 (still ?? on main).
  assert.match(
    settingsSource,
    /restaurant\?\.name \?\? t\("settings\.profile\.noRestaurant"\)/
  );

  // Leave Sales Import hero restaurant-name tip path on open #1022 (still ?? on main).
  assert.match(
    salesImportSource,
    /restaurant\?\.name \?\? t\("common\.notSet"\)/
  );

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleCuisineIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSalesImportRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Insights subtitle restaurant names stable", () => {
  assert.equal(asciiTrimInsightsSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimInsightsSubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeInsightsSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeInsightsSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeInsightsSubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Insights subtitle fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still chose subtitleRestaurantStyle
  // instead of the intentional localized insights.subtitle fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseStyledSubtitle = (restaurantPresent: boolean, name: string) =>
    restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the styled subtitle path and skip insights.subtitle.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseStyledSubtitle(true, unicodeOnly), true);
  assert.equal(priorChoseStyledSubtitle(true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized insights.subtitle fallback.
  assert.equal(normalizeInsightsSubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeInsightsSubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeInsightsSubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Insights subtitle restaurant names", () => {
  const padded = `${em}${restaurantName}${em}`;
  const nbspName = `${nbsp}${restaurantName}${nbsp}`;
  const internalEm = `Luna${em}Bistro`;
  const internalNbsp = `Luna${nbsp}Bistro`;

  // Inventing proof: Unicode trim would invent the clean restaurant name.
  assert.equal(padded.trim(), restaurantName);
  assert.equal(nbspName.trim(), restaurantName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimInsightsSubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeInsightsSubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeInsightsSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(padded), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInsightsSubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeInsightsSubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeInsightsSubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Insights subtitle restaurant names", () => {
  assert.equal(normalizeInsightsSubtitleRestaurantName(undefined), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(null), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(""), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName("   "), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInsightsSubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeInsightsSubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeInsightsSubtitleRestaurantName(em), null);
});
