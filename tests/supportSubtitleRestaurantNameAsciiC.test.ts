import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupportSubtitleRestaurantName,
  canonicalizeSupportSubtitleRestaurantName,
  normalizeSupportSubtitleRestaurantName
} from "../services/domain/presentationSupportSubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSupportSubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WE pins Support subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WE/);
  assert.match(supportSource, /MISE-005WE/);

  assert.match(
    identitySource,
    /export function asciiTrimSupportSubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    supportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSupportSubtitleRestaurantNameIdentity"/
  );
  assert.match(supportSource, /normalizeSupportSubtitleRestaurantName\(/);
  assert.match(
    supportSource,
    /signedIn && restaurant && supportSubtitleRestaurantName\s*\?\s*t\("support\.subtitleRestaurant"/
  );
  assert.match(supportSource, /restaurant: supportSubtitleRestaurantName/);
  assert.doesNotMatch(
    supportSource,
    /signedIn && restaurant\s*\?\s*t\("support\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Privacy subtitleRestaurant alone (open #1036 / MISE-005WD on tip branch).
  assert.match(
    privacySource,
    /signedIn && restaurant\s*\?\s*t\("privacy\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
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
  assert.doesNotMatch(identityCode, /presentationPrivacySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Support subtitle restaurant names stable", () => {
  assert.equal(asciiTrimSupportSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimSupportSubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeSupportSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSupportSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSupportSubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Support subtitle fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a signed-in restaurant
  // object with a non-nullish empty / Unicode-only name still chose
  // support.subtitleRestaurant instead of the intentional localized
  // support.subtitle fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (signedIn: boolean, restaurantPresent: boolean, name: string) =>
    signedIn && restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip support.subtitle.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized support.subtitle fallback.
  assert.equal(normalizeSupportSubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSupportSubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSupportSubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Support subtitle restaurant names", () => {
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
  assert.equal(asciiTrimSupportSubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeSupportSubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeSupportSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(padded), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSupportSubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeSupportSubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeSupportSubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Support subtitle restaurant names", () => {
  assert.equal(normalizeSupportSubtitleRestaurantName(undefined), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(null), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(""), null);
  assert.equal(normalizeSupportSubtitleRestaurantName("   "), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSupportSubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeSupportSubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeSupportSubtitleRestaurantName(em), null);
});
