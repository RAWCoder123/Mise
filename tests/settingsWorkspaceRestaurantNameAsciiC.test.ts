import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSettingsWorkspaceRestaurantName,
  canonicalizeSettingsWorkspaceRestaurantName,
  normalizeSettingsWorkspaceRestaurantName
} from "../services/domain/presentationSettingsWorkspaceRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSettingsWorkspaceRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
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

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WM pins Settings workspace item.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WM/);
  assert.match(settingsSource, /MISE-005WM/);

  assert.match(
    identitySource,
    /export function asciiTrimSettingsWorkspaceRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    settingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSettingsWorkspaceRestaurantNameIdentity"/
  );
  assert.match(settingsSource, /normalizeSettingsWorkspaceRestaurantName\(/);
  assert.match(
    settingsSource,
    /normalizeSettingsWorkspaceRestaurantName\(item\.name\) \|\|\s*t\("settings\.workspace\.metaFallback"\)/
  );
  assert.match(
    settingsSource,
    /accessibilityLabel=\{t\(\s*selected \? "settings\.workspace\.currentAccessibility" : "settings\.workspace\.switchAccessibility",\s*\{\s*restaurant: workspaceRestaurantName/
  );
  assert.match(settingsSource, /styles\.workspaceName\}\>\{workspaceRestaurantName\}/);
  assert.doesNotMatch(
    settingsSource,
    /accessibilityLabel=\{t\(\s*selected \? "settings\.workspace\.currentAccessibility" : "settings\.workspace\.switchAccessibility",\s*\{\s*restaurant: item\.name/
  );
  assert.doesNotMatch(settingsSource, /styles\.workspaceName\}\>\{item\.name\}/);

  // Leave workspace cuisine_type ?? metaFallback alone on main (open #1023 / MISE-005VO).
  assert.match(
    settingsSource,
    /item\.cuisine_type \?\? t\("settings\.workspace\.metaFallback"\)/
  );
  assert.doesNotMatch(settingsSource, /normalizeSettingsWorkspaceCuisine\(/);
  assert.doesNotMatch(
    settingsSource,
    /presentationSettingsWorkspaceCuisineIdentity/
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

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationSettingsWorkspaceCuisineIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSalesImportRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTeamSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivitySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationPrivacySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Settings workspace restaurant names stable", () => {
  assert.equal(asciiTrimSettingsWorkspaceRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimSettingsWorkspaceRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeSettingsWorkspaceRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSettingsWorkspaceRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Settings workspace metaFallback for item.name", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior always-pass-name row: raw item.name was rendered into
  // the workspace name Text and a11y restaurant token even when empty /
  // Unicode-only space, so the intentional localized metaFallback never owned
  // blank-looking restaurant identity for the name line.
  const priorDisplay = (value: string | null | undefined) =>
    value !== null && value !== undefined ? value : "FALLBACK";
  const priorA11yRestaurant = (value: string) => value;

  // Bypass proof: non-nullish Unicode-only space / empty string still select
  // the raw restaurant-name path and skip metaFallback for the name line / a11y.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.equal(priorA11yRestaurant(unicodeOnly), unicodeOnly);
  assert.equal(priorA11yRestaurant(empty), empty);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized metaFallback.
  assert.equal(normalizeSettingsWorkspaceRestaurantName(unicodeOnly), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(nbspOnly), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsWorkspaceRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsWorkspaceRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Settings workspace restaurant names", () => {
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
  assert.equal(asciiTrimSettingsWorkspaceRestaurantName(padded), padded);
  assert.equal(canonicalizeSettingsWorkspaceRestaurantName(padded), null);
  assert.equal(canonicalizeSettingsWorkspaceRestaurantName(nbspName), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(padded), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(nbspName), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSettingsWorkspaceRestaurantName(internalEm), internalEm);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings workspace restaurant names", () => {
  assert.equal(normalizeSettingsWorkspaceRestaurantName(undefined), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(null), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(""), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName("   "), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSettingsWorkspaceRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeSettingsWorkspaceRestaurantName(em), null);
});
