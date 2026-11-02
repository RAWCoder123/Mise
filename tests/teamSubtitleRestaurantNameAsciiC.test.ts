import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimTeamSubtitleRestaurantName,
  canonicalizeTeamSubtitleRestaurantName,
  normalizeTeamSubtitleRestaurantName
} from "../services/domain/presentationTeamSubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationTeamSubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const teamSource = readFileSync(new URL("../app/settings/team.tsx", import.meta.url), "utf8");
const askSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const memorySource = readFileSync(new URL("../app/more/restaurant-memory.tsx", import.meta.url), "utf8");
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WL pins Team subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WL/);
  assert.match(teamSource, /MISE-005WL/);

  assert.match(
    identitySource,
    /export function asciiTrimTeamSubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    teamSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationTeamSubtitleRestaurantNameIdentity"/
  );
  assert.match(teamSource, /normalizeTeamSubtitleRestaurantName\(/);
  assert.match(
    teamSource,
    /restaurant && teamSubtitleRestaurantName\s*\?\s*teamSubtitleRestaurantName\s*:\s*t\("team\.subtitle"\)/
  );
  assert.doesNotMatch(
    teamSource,
    /subtitle=\{restaurant \? restaurant\.name : t\("team\.subtitle"\)\}/
  );

  // Leave Ask Mise greeting restaurant.name alone on main (open #1045 / MISE-005WK).
  assert.match(
    askSource,
    /t\("ask\.greeting\.body", \{\s*restaurant: restaurant\.name/
  );

  // Leave Home greeting restaurant.name alone on main (open #1044 / MISE-005WJ).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave Autonomy subtitle alone (open #1043 / MISE-005WI).
  assert.match(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Restaurant Memory subtitle alone (open #1042 / MISE-005WH).
  assert.match(
    memorySource,
    /restaurant\s*\?\s*t\("memory\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Activity subtitle alone (open #1041 / MISE-005WG).
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
  assert.doesNotMatch(identityCode, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationMemorySubtitleRestaurantNameIdentity/);
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

test("ASCII C prep keeps ordinary Team subtitle restaurant names stable", () => {
  assert.equal(asciiTrimTeamSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimTeamSubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeTeamSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeTeamSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeTeamSubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Team subtitle fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-pass-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still chose restaurant.name instead
  // of the intentional localized team.subtitle fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (restaurantPresent: boolean, name: string) =>
    restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip team.subtitle.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized team.subtitle fallback.
  assert.equal(normalizeTeamSubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeTeamSubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeTeamSubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Team subtitle restaurant names", () => {
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
  assert.equal(asciiTrimTeamSubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeTeamSubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeTeamSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(padded), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeTeamSubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeTeamSubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeTeamSubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Team subtitle restaurant names", () => {
  assert.equal(normalizeTeamSubtitleRestaurantName(undefined), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(null), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(""), null);
  assert.equal(normalizeTeamSubtitleRestaurantName("   "), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeTeamSubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeTeamSubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeTeamSubtitleRestaurantName(em), null);
});
