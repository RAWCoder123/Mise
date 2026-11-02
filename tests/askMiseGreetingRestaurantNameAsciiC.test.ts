import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAskMiseGreetingRestaurantName,
  canonicalizeAskMiseGreetingRestaurantName,
  normalizeAskMiseGreetingRestaurantName
} from "../services/domain/presentationAskMiseGreetingRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const askMiseSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const memorySource = readFileSync(new URL("../app/more/restaurant-memory.tsx", import.meta.url), "utf8");
const activitySource = readFileSync(new URL("../app/more/activity.tsx", import.meta.url), "utf8");
const supportSource = readFileSync(new URL("../app/settings/support.tsx", import.meta.url), "utf8");
const privacySource = readFileSync(new URL("../app/settings/privacy.tsx", import.meta.url), "utf8");
const countSource = readFileSync(new URL("../app/inventory/count.tsx", import.meta.url), "utf8");
const insightsSource = readFileSync(new URL("../app/(tabs)/insights.tsx", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");
const teamSource = readFileSync(new URL("../app/settings/team.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WK pins Ask Mise greeting restaurant.name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WK/);
  assert.match(askMiseSource, /MISE-005WK/);

  assert.match(
    identitySource,
    /export function asciiTrimAskMiseGreetingRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    askMiseSource,
    /from "\.\.\/services\/domain\/presentationAskMiseGreetingRestaurantNameIdentity"/
  );
  assert.match(askMiseSource, /normalizeAskMiseGreetingRestaurantName\(/);
  assert.match(
    askMiseSource,
    /askGreetingRestaurantName\s*\?\s*t\("ask\.greeting\.body"/
  );
  assert.match(askMiseSource, /restaurant: askGreetingRestaurantName/);
  assert.match(askMiseSource, /t\("ask\.greeting\.body\.none"\)/);
  assert.doesNotMatch(
    askMiseSource,
    /t\("ask\.greeting\.body", \{\s*restaurant: restaurant\.name/
  );

  assert.match(
    catalogSource,
    /"ask\.greeting\.body\.none": "I have today’s board in mind\. Ask about priorities, stock, orders, or today’s sales\."/
  );
  assert.match(
    catalogSource,
    /"ask\.greeting\.body\.none": "Tengo el tablero de hoy en mente\. Pregunta por prioridades, stock, pedidos o las ventas de hoy\."/
  );
  assert.match(catalogSource, /"ask\.greeting\.body\.none": "我已掌握今日看板。可以问我优先事项、库存、订单或今日销售。"/);

  // Leave Home greeting restaurant.name alone on main (open #1044 / MISE-005WJ).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name/
  );

  // Leave Autonomy subtitle alone on main (open #1043 / MISE-005WI tip branch).
  assert.match(
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

  // Leave team subtitle restaurant.name alone (pass-through tip candidate).
  assert.match(
    teamSource,
    /subtitle=\{restaurant \? restaurant\.name : t\("team\.subtitle"\)\}/
  );

  // Leave Home ApprovalsSection card titles alone (raw pass-through).
  assert.match(homeSource, /\{card\.title\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivitySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSupportSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationPrivacySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInventoryCountSubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSalesImportRestaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeAskMiseGreetingRestaurantName(restaurantName), restaurantName);
  assert.equal(normalizeAskMiseGreetingRestaurantName(` ${restaurantName} `), restaurantName);
  assert.equal(normalizeAskMiseGreetingRestaurantName(`Café ${restaurantName}`), `Café ${restaurantName}`);
});

test("Unicode padding invents via trim and is soft-nulled for Ask Mise greeting restaurant names", () => {
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
  assert.equal(asciiTrimAskMiseGreetingRestaurantName(padded), padded);
  assert.equal(canonicalizeAskMiseGreetingRestaurantName(padded), null);
  assert.equal(canonicalizeAskMiseGreetingRestaurantName(nbspName), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(padded), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(nbspName), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeAskMiseGreetingRestaurantName(internalEm), internalEm);
  assert.equal(normalizeAskMiseGreetingRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeAskMiseGreetingRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Ask Mise greeting restaurant names", () => {
  assert.equal(normalizeAskMiseGreetingRestaurantName(undefined), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(null), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(""), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName("   "), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeAskMiseGreetingRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeAskMiseGreetingRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(em), null);
});

test("Ask Mise greeting bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-interpolate path would still render ask.greeting.body with
  // blank-looking restaurant identity when a restaurant object existed.
  assert.equal(normalizeAskMiseGreetingRestaurantName(""), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(em), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(nbsp), null);
  assert.match(askMiseSource, /askGreetingRestaurantName\s*\?\s*t\("ask\.greeting\.body"/);
  assert.match(askMiseSource, /:\s*t\("ask\.greeting\.body\.none"\)/);
});

test("Ask Mise greeting restaurant-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${restaurantName}${em}`;
  assert.notEqual(asciiTrimAskMiseGreetingRestaurantName(padded), padded.trim());
  assert.equal(normalizeAskMiseGreetingRestaurantName(padded), null);
  assert.equal(normalizeAskMiseGreetingRestaurantName(`\t${restaurantName}\n`), restaurantName);
});
