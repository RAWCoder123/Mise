import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAutonomySubtitleRestaurantName,
  canonicalizeAutonomySubtitleRestaurantName,
  normalizeAutonomySubtitleRestaurantName
} from "../services/domain/presentationAutonomySubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAutonomySubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const memorySource = readFileSync(new URL("../app/more/restaurant-memory.tsx", import.meta.url), "utf8");
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const askMiseSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WI pins Autonomy subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WI/);
  assert.match(autonomySource, /MISE-005WI/);

  assert.match(
    identitySource,
    /export function asciiTrimAutonomySubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    autonomySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationAutonomySubtitleRestaurantNameIdentity"/
  );
  assert.match(autonomySource, /normalizeAutonomySubtitleRestaurantName\(/);
  assert.match(
    autonomySource,
    /restaurant && autonomySubtitleRestaurantName\s*\?\s*t\("autonomy\.subtitle"/
  );
  assert.match(autonomySource, /restaurant: autonomySubtitleRestaurantName/);
  assert.doesNotMatch(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Restaurant Memory subtitle alone (open #1042 / MISE-005WH).
  assert.match(
    memorySource,
    /restaurant\s*\?\s*t\("memory\.subtitle", \{\s*restaurant: restaurant\.name/
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

  // Leave Home greeting restaurant.name alone (sibling tip candidate).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name\s*\}\)/
  );

  // Leave Ask Mise restaurant.name alone (sibling tip candidate).
  assert.match(
    askMiseSource,
    /restaurant: restaurant\.name/
  );

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivitySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationPrivacySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Autonomy subtitle restaurant names stable", () => {
  assert.equal(asciiTrimAutonomySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimAutonomySubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeAutonomySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeAutonomySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeAutonomySubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Autonomy subtitle.none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still chose autonomy.subtitle instead
  // of the intentional localized autonomy.subtitle.none fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (restaurantPresent: boolean, name: string) =>
    restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip autonomy.subtitle.none.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized autonomy.subtitle.none fallback.
  assert.equal(normalizeAutonomySubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeAutonomySubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeAutonomySubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Autonomy subtitle restaurant names", () => {
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
  assert.equal(asciiTrimAutonomySubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeAutonomySubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeAutonomySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(padded), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeAutonomySubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeAutonomySubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeAutonomySubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Autonomy subtitle restaurant names", () => {
  assert.equal(normalizeAutonomySubtitleRestaurantName(undefined), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(null), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(""), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName("   "), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeAutonomySubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeAutonomySubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeAutonomySubtitleRestaurantName(em), null);
});
