import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPrivacySubtitleRestaurantName,
  canonicalizePrivacySubtitleRestaurantName,
  normalizePrivacySubtitleRestaurantName
} from "../services/domain/presentationPrivacySubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationPrivacySubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WD pins Privacy subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WD/);
  assert.match(privacySource, /MISE-005WD/);

  assert.match(
    identitySource,
    /export function asciiTrimPrivacySubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    privacySource,
    /from "\.\.\/\.\.\/services\/domain\/presentationPrivacySubtitleRestaurantNameIdentity"/
  );
  assert.match(privacySource, /normalizePrivacySubtitleRestaurantName\(/);
  assert.match(
    privacySource,
    /signedIn && restaurant && privacySubtitleRestaurantName\s*\?\s*t\("privacy\.subtitleRestaurant"/
  );
  assert.match(privacySource, /restaurant: privacySubtitleRestaurantName/);
  assert.doesNotMatch(
    privacySource,
    /signedIn && restaurant\s*\?\s*t\("privacy\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Support subtitleRestaurant alone (sibling tip candidate).
  assert.match(
    supportSource,
    /signedIn && restaurant\s*\?\s*t\("support\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave inventory count subtitleRestaurant alone (sibling tip candidate).
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
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Privacy subtitle restaurant names stable", () => {
  assert.equal(asciiTrimPrivacySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimPrivacySubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizePrivacySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizePrivacySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizePrivacySubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Privacy subtitle fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a signed-in restaurant
  // object with a non-nullish empty / Unicode-only name still chose
  // privacy.subtitleRestaurant instead of the intentional localized
  // privacy.subtitle fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (signedIn: boolean, restaurantPresent: boolean, name: string) =>
    signedIn && restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip privacy.subtitle.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized privacy.subtitle fallback.
  assert.equal(normalizePrivacySubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizePrivacySubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizePrivacySubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Privacy subtitle restaurant names", () => {
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
  assert.equal(asciiTrimPrivacySubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizePrivacySubtitleRestaurantName(padded), null);
  assert.equal(canonicalizePrivacySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(padded), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizePrivacySubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizePrivacySubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizePrivacySubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Privacy subtitle restaurant names", () => {
  assert.equal(normalizePrivacySubtitleRestaurantName(undefined), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(null), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(""), null);
  assert.equal(normalizePrivacySubtitleRestaurantName("   "), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizePrivacySubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizePrivacySubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizePrivacySubtitleRestaurantName(em), null);
});
