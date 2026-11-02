import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivitySubtitleRestaurantName,
  canonicalizeActivitySubtitleRestaurantName,
  normalizeActivitySubtitleRestaurantName
} from "../services/domain/presentationActivitySubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationActivitySubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const memorySource = readFileSync(new URL("../app/more/restaurant-memory.tsx", import.meta.url), "utf8");
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WG pins Activity subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WG/);
  assert.match(activitySource, /MISE-005WG/);

  assert.match(
    identitySource,
    /export function asciiTrimActivitySubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationActivitySubtitleRestaurantNameIdentity"/
  );
  assert.match(activitySource, /normalizeActivitySubtitleRestaurantName\(/);
  assert.match(
    activitySource,
    /restaurant && activitySubtitleRestaurantName\s*\?\s*t\("activity\.subtitle"/
  );
  assert.match(activitySource, /restaurant: activitySubtitleRestaurantName/);
  assert.doesNotMatch(
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

  // Leave Restaurant Memory subtitle alone (sibling tip candidate).
  assert.match(
    memorySource,
    /restaurant\s*\?\s*t\("memory\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Autonomy subtitle alone (sibling tip candidate).
  assert.match(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Settings profile restaurant-name tip path on open #1021 (still ?? on main).
  assert.match(
    settingsSource,
    /restaurant\?\.name \?\? t\("settings\.profile\.noRestaurant"\)/
  );

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationPrivacySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Activity subtitle restaurant names stable", () => {
  assert.equal(asciiTrimActivitySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimActivitySubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeActivitySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeActivitySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeActivitySubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Activity subtitle.none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still chose activity.subtitle instead
  // of the intentional localized activity.subtitle.none fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (restaurantPresent: boolean, name: string) =>
    restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip activity.subtitle.none.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized activity.subtitle.none fallback.
  assert.equal(normalizeActivitySubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeActivitySubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeActivitySubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Activity subtitle restaurant names", () => {
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
  assert.equal(asciiTrimActivitySubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeActivitySubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeActivitySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(padded), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivitySubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeActivitySubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeActivitySubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity subtitle restaurant names", () => {
  assert.equal(normalizeActivitySubtitleRestaurantName(undefined), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(null), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(""), null);
  assert.equal(normalizeActivitySubtitleRestaurantName("   "), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivitySubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeActivitySubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeActivitySubtitleRestaurantName(em), null);
});
