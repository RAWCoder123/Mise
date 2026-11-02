import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryCountSubtitleRestaurantName,
  canonicalizeInventoryCountSubtitleRestaurantName,
  normalizeInventoryCountSubtitleRestaurantName
} from "../services/domain/presentationInventoryCountSubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryCountSubtitleRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const inventorySource = readFileSync(new URL("../app/(tabs)/inventory.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WF pins Inventory Count subtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WF/);
  assert.match(countSource, /MISE-005WF/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryCountSubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    countSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryCountSubtitleRestaurantNameIdentity"/
  );
  assert.match(countSource, /normalizeInventoryCountSubtitleRestaurantName\(/);
  assert.match(
    countSource,
    /inventoryCountSubtitleRestaurantName\s*\?\s*t\("inventory\.count\.subtitleRestaurant"/
  );
  assert.match(countSource, /restaurant: inventoryCountSubtitleRestaurantName/);
  assert.match(countSource, /: t\("inventory\.count\.subtitle"\)/);
  assert.doesNotMatch(
    countSource,
    /t\("inventory\.count\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Support subtitleRestaurant alone (open #1039 / MISE-005WE on tip branch).
  assert.match(
    supportSource,
    /signedIn && restaurant\s*\?\s*t\("support\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Privacy subtitleRestaurant alone (open #1036 / MISE-005WD on tip branch).
  assert.match(
    privacySource,
    /signedIn && restaurant\s*\?\s*t\("privacy\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Insights hub subtitle path alone on main (prior tip branch not merged).
  assert.match(
    insightsSource,
    /restaurant\s*\?\s*t\("insights\.subtitleRestaurantStyle"/
  );

  // Leave inventory hub subtitle alone (uses inventory.subtitle, not count tip).
  assert.match(inventorySource, /subtitle=\{t\("inventory\.subtitle"\)\}/);
  assert.doesNotMatch(
    inventorySource,
    /presentationInventoryCountSubtitleRestaurantNameIdentity/
  );
  assert.doesNotMatch(inventorySource, /inventory\.subtitleRestaurant/);

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
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Inventory Count subtitle restaurant names stable", () => {
  assert.equal(asciiTrimInventoryCountSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimInventoryCountSubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeInventoryCountSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Inventory Count subtitle fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-interpolate-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still chose
  // inventory.count.subtitleRestaurant instead of the intentional localized
  // inventory.count.subtitle fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorChoseRestaurantSubtitle = (restaurantPresent: boolean, name: string) =>
    restaurantPresent && name !== null && name !== undefined;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the restaurant subtitle path and skip inventory.count.subtitle.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorChoseRestaurantSubtitle(true, unicodeOnly), true);
  assert.equal(priorChoseRestaurantSubtitle(true, empty), true);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized inventory.count.subtitle fallback.
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeInventoryCountSubtitleRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Inventory Count subtitle restaurant names", () => {
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
  assert.equal(asciiTrimInventoryCountSubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeInventoryCountSubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeInventoryCountSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(padded), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryCountSubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory Count subtitle restaurant names", () => {
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(undefined), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(null), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(""), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName("   "), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeInventoryCountSubtitleRestaurantName(em), null);
});
