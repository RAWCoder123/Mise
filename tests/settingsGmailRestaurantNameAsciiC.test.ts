import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSettingsGmailRestaurantName,
  canonicalizeSettingsGmailRestaurantName,
  normalizeSettingsGmailRestaurantName
} from "../services/domain/presentationSettingsGmailRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSettingsGmailRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const gmailSource = readFileSync(new URL("../app/settings/gmail.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
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
const salesImportSource = readFileSync(new URL("../app/settings/sales-import.tsx", import.meta.url), "utf8");
const suppliersSource = readFileSync(new URL("../app/settings/suppliers.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WN pins Settings Gmail connectionSubtitle restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WN/);
  assert.match(gmailSource, /MISE-005WN/);

  assert.match(
    identitySource,
    /export function asciiTrimSettingsGmailRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    gmailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSettingsGmailRestaurantNameIdentity"/
  );
  assert.match(gmailSource, /normalizeSettingsGmailRestaurantName\(/);
  assert.match(
    gmailSource,
    /normalizeSettingsGmailRestaurantName\(restaurant\?\.name\) \|\|\s*t\("settings\.gmail\.connectionSubtitle\.none"\)/
  );
  assert.match(
    gmailSource,
    /styles\.connectionSubtitle\}\>\{gmailConnectionSubtitleRestaurantName\}/
  );
  assert.doesNotMatch(gmailSource, /styles\.connectionSubtitle\}\>\{restaurant\.name\}/);

  assert.match(catalogSource, /"settings\.gmail\.connectionSubtitle\.none": "Restaurant workspace"/);
  assert.match(catalogSource, /"settings\.gmail\.connectionSubtitle\.none": "Espacio de restaurante"/);
  assert.match(catalogSource, /"settings\.gmail\.connectionSubtitle\.none": "餐厅工作区"/);

  // Leave Settings Gmail sender_email display alone on main (open #1019 / MISE-005VK).
  assert.match(
    gmailSource,
    /visibleConnection\?\.sender_email \?\? t\("settings\.gmail\.status\.notConnected"\)/
  );

  // Leave Settings workspace item.name alone on main (open #1047 / MISE-005WM).
  assert.match(settingsSource, /styles\.workspaceName\}\>\{item\.name\}/);
  assert.match(
    settingsSource,
    /accessibilityLabel=\{t\(\s*selected \? "settings\.workspace\.currentAccessibility" : "settings\.workspace\.switchAccessibility",\s*\{\s*restaurant: item\.name/
  );

  // Leave Team subtitle restaurant.name alone on main (open #1046 / MISE-005WL).
  assert.match(
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

  // Leave Autonomy subtitle restaurant.name alone on main (open #1043).
  assert.match(
    autonomySource,
    /restaurant \? t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Memory subtitle restaurant.name alone on main (open #1042).
  assert.match(
    memorySource,
    /restaurant \? t\("memory\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Activity subtitle restaurant.name alone on main (open #1041).
  assert.match(
    activitySource,
    /restaurant \? t\("activity\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Support subtitleRestaurant alone on main (open #1039 / MISE-005WE).
  assert.match(
    supportSource,
    /signedIn && restaurant\s*\?\s*t\("support\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Privacy subtitleRestaurant alone on main (open #1036 / MISE-005WD).
  assert.match(
    privacySource,
    /signedIn && restaurant\s*\?\s*t\("privacy\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave inventory count subtitleRestaurant alone (open #1040).
  assert.match(
    countSource,
    /t\("inventory\.count\.subtitleRestaurant", \{\s*restaurant: restaurant\.name/
  );

  // Leave Insights hub subtitle path alone on main (open #1037).
  assert.match(
    insightsSource,
    /restaurant\s*\?\s*t\("insights\.subtitleRestaurantStyle"/
  );

  // Leave Settings profile restaurant-name tip path on open #1021 (still ?? on main).
  assert.match(
    settingsSource,
    /restaurant\?\.name \?\? t\("settings\.profile\.noRestaurant"\)/
  );

  // Leave Sales Import hero restaurant-name alone on main (open #1022).
  assert.match(
    salesImportSource,
    /restaurant\?\.name \?\? t\("common\.notSet"\)/
  );

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  // Leave suppliers recipient-email tip path alone on main (open #1032).
  assert.match(suppliersSource, /entry\.email/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationSettingsWorkspaceRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTeamSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsGmailSenderEmailIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Settings Gmail restaurant names stable", () => {
  assert.equal(asciiTrimSettingsGmailRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimSettingsGmailRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeSettingsGmailRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSettingsGmailRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSettingsGmailRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Settings Gmail connectionSubtitle fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-pass-name row: a restaurant object with a
  // non-nullish empty / Unicode-only name still rendered as connectionSubtitle
  // instead of the intentional localized connectionSubtitle.none fallback.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the raw restaurant.name path and skip settings.gmail.connectionSubtitle.none.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized connectionSubtitle.none fallback.
  assert.equal(normalizeSettingsGmailRestaurantName(unicodeOnly), null);
  assert.equal(normalizeSettingsGmailRestaurantName(nbspOnly), null);
  assert.equal(normalizeSettingsGmailRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsGmailRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsGmailRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Settings Gmail restaurant names", () => {
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
  assert.equal(asciiTrimSettingsGmailRestaurantName(padded), padded);
  assert.equal(canonicalizeSettingsGmailRestaurantName(padded), null);
  assert.equal(canonicalizeSettingsGmailRestaurantName(nbspName), null);
  assert.equal(normalizeSettingsGmailRestaurantName(padded), null);
  assert.equal(normalizeSettingsGmailRestaurantName(nbspName), null);
  assert.equal(normalizeSettingsGmailRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSettingsGmailRestaurantName(internalEm), internalEm);
  assert.equal(normalizeSettingsGmailRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeSettingsGmailRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings Gmail restaurant names", () => {
  assert.equal(normalizeSettingsGmailRestaurantName(undefined), null);
  assert.equal(normalizeSettingsGmailRestaurantName(null), null);
  assert.equal(normalizeSettingsGmailRestaurantName(""), null);
  assert.equal(normalizeSettingsGmailRestaurantName("   "), null);
  assert.equal(normalizeSettingsGmailRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeSettingsGmailRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSettingsGmailRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeSettingsGmailRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeSettingsGmailRestaurantName(em), null);
});
