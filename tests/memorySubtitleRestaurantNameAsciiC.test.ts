import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimMemorySubtitleRestaurantName,
  canonicalizeMemorySubtitleRestaurantName,
  normalizeMemorySubtitleRestaurantName
} from "../services/domain/presentationMemorySubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationMemorySubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const memorySource = readFileSync(new URL("../app/more/restaurant-memory.tsx", import.meta.url), "utf8");
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WH pins Restaurant Memory subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WH/);
  assert.match(memorySource, /MISE-005WH/);

  assert.match(
    identitySource,
    /export function asciiTrimMemorySubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    memorySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationMemorySubtitleRestaurantNameIdentity"/
  );
  assert.match(memorySource, /normalizeMemorySubtitleRestaurantName\(/);
  assert.match(
    memorySource,
    /restaurant && memorySubtitleRestaurantName\s*\?\s*t\("memory\.subtitle"/
  );
  assert.match(memorySource, /restaurant: memorySubtitleRestaurantName/);
  assert.doesNotMatch(
    memorySource,
    /restaurant\s*\?\s*t\("memory\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Autonomy subtitle alone (sibling tip candidate).
  assert.match(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Activity History subtitle alone (open #1041 / MISE-005WG).
  assert.match(
    activitySource,
    /restaurant\s*\?\s*t\("activity\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Support subtitleRestaurant alone (open #1039 / MISE-005WE).
  assert.match(
    supportSource,
    /signedIn && restaurant\s*\?\s*t\("support\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Privacy subtitleRestaurant alone (open #1036 / MISE-005WD).
  assert.match(
    privacySource,
    /signedIn && restaurant\s*\?\s*t\("privacy\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave inventory count subtitleRestaurant alone (open #1040 / MISE-005WF).
  assert.match(
    countSource,
    /t\("inventory\.count\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Insights hub subtitle path alone on main (prior tip branch not merged).
  assert.match(
    insightsSource,
    /restaurant\s*\?\s*t\("insights\.subtitleRestaurantStyle"/
  );

  // Leave Settings profile restaurant-name tip path on open #1021 (still ?? on main).
  assert.match(
    settingsSource,
    /restaurant\?\.name \?\? t\("settings\.profile\.noRestaurant"\)/
  );

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivitySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationPrivacySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Restaurant Memory subtitle restaurant names stable", () => {
  assert.equal(asciiTrimMemorySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimMemorySubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeMemorySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeMemorySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeMemorySubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Memory subtitle.none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still chose memory.subtitle instead
  // of the intentional localized memory.subtitle.none fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (restaurantPresent: boolean, name: string) =>
    restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip memory.subtitle.none.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized memory.subtitle.none fallback.
  assert.equal(normalizeMemorySubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeMemorySubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeMemorySubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Memory subtitle restaurant names", () => {
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
  assert.equal(asciiTrimMemorySubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeMemorySubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeMemorySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(padded), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeMemorySubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeMemorySubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeMemorySubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Memory subtitle restaurant names", () => {
  assert.equal(normalizeMemorySubtitleRestaurantName(undefined), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(null), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(""), null);
  assert.equal(normalizeMemorySubtitleRestaurantName("   "), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeMemorySubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeMemorySubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeMemorySubtitleRestaurantName(em), null);
});
