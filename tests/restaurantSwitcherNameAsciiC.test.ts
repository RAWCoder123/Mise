import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantSwitcherName,
  canonicalizeRestaurantSwitcherName,
  normalizeRestaurantSwitcherName
} from "../services/domain/presentationRestaurantSwitcherNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRestaurantSwitcherNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const switcherSource = readFileSync(
  new URL("../components/ui/RestaurantSwitcher.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const autonomySource = readFileSync(new URL("../app/settings/autonomy.tsx", import.meta.url), "utf8");
const homeSource = readFileSync(new URL("../app/(tabs)/home.tsx", import.meta.url), "utf8");
const askMiseSource = readFileSync(new URL("../app/ask-mise.tsx", import.meta.url), "utf8");
const todaySource = readFileSync(new URL("../app/(tabs)/today.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XS pins RestaurantSwitcher a11y restaurant name to ASCII C", () => {
  assert.match(identitySource, /MISE-005XS/);
  assert.match(switcherSource, /MISE-005XS/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantSwitcherName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    switcherSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRestaurantSwitcherNameIdentity"/
  );
  assert.match(switcherSource, /normalizeRestaurantSwitcherName\(/);
  assert.match(
    switcherSource,
    /restaurantSwitcherName\s*\?\s*t\("screen\.openRestaurantSettings", \{\s*restaurant: restaurantSwitcherName\s*\}\)\s*:\s*t\("screen\.openRestaurantSettings\.none"\)/
  );
  assert.doesNotMatch(
    switcherSource,
    /accessibilityLabel=\{t\("screen\.openRestaurantSettings", \{\s*restaurant: name\s*\}\)/
  );

  assert.match(catalogSource, /"screen\.openRestaurantSettings\.none": "Open restaurant settings"/);
  assert.match(catalogSource, /"screen\.openRestaurantSettings\.none": "Abrir los ajustes del restaurante"/);
  assert.match(catalogSource, /"screen\.openRestaurantSettings\.none": "打开餐厅设置"/);

  // Leave chip display Text `{name}` alone.
  assert.match(switcherSource, /\{name\}/);

  // Leave Autonomy subtitle restaurant.name alone (open #1043 / MISE-005WI).
  assert.match(
    autonomySource,
    /restaurant\s*\?\s*t\("autonomy\.subtitle", \{\s*restaurant: restaurant\.name/
  );

  // Leave Home greeting restaurant.name alone (open #1044 / MISE-005WJ).
  assert.match(
    homeSource,
    /t\("home\.greeting\.subtext", \{\s*restaurant: restaurant\.name\s*\}\)/
  );

  // Leave Ask Mise restaurant.name alone (open #1045 / MISE-005WK).
  assert.match(askMiseSource, /restaurant: restaurant\.name/);

  // Leave Today screen title restaurant-name path alone (open #968 / MISE-005UD).
  assert.match(todaySource, /restaurant\.name/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /presentationMemorySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationActivitySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationOperatingPlanTaskDetailIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRestaurantSwitcherName(restaurantName), restaurantName);
  assert.equal(normalizeRestaurantSwitcherName(` ${restaurantName} `), restaurantName);
  assert.equal(normalizeRestaurantSwitcherName(`Case-${restaurantName}`), `Case-${restaurantName}`);
});

test("Unicode padding invents via trim and is soft-nulled for RestaurantSwitcher a11y names", () => {
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
  assert.equal(asciiTrimRestaurantSwitcherName(padded), padded);
  assert.equal(canonicalizeRestaurantSwitcherName(padded), null);
  assert.equal(canonicalizeRestaurantSwitcherName(nbspName), null);
  assert.equal(normalizeRestaurantSwitcherName(padded), null);
  assert.equal(normalizeRestaurantSwitcherName(nbspName), null);
  assert.equal(normalizeRestaurantSwitcherName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRestaurantSwitcherName(internalEm), internalEm);
  assert.equal(normalizeRestaurantSwitcherName(internalNbsp), internalNbsp);
  assert.equal(normalizeRestaurantSwitcherName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for RestaurantSwitcher a11y names", () => {
  assert.equal(normalizeRestaurantSwitcherName(undefined), null);
  assert.equal(normalizeRestaurantSwitcherName(null), null);
  assert.equal(normalizeRestaurantSwitcherName(""), null);
  assert.equal(normalizeRestaurantSwitcherName("   "), null);
  assert.equal(normalizeRestaurantSwitcherName(123 as unknown as string), null);
  assert.equal(normalizeRestaurantSwitcherName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRestaurantSwitcherName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeRestaurantSwitcherName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeRestaurantSwitcherName(em), null);
});

test("RestaurantSwitcher a11y bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still interpolated blank-looking restaurant into a11y.
  assert.equal(normalizeRestaurantSwitcherName(""), null);
  assert.equal(normalizeRestaurantSwitcherName(em), null);
  assert.equal(normalizeRestaurantSwitcherName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    switcherSource,
    /restaurantSwitcherName\s*\?\s*t\("screen\.openRestaurantSettings", \{\s*restaurant: restaurantSwitcherName\s*\}\)\s*:\s*t\("screen\.openRestaurantSettings\.none"\)/
  );
});

test("RestaurantSwitcher a11y restaurant name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${restaurantName}${em}`;
  assert.notEqual(asciiTrimRestaurantSwitcherName(padded), padded.trim());
  assert.equal(normalizeRestaurantSwitcherName(padded), null);
  assert.equal(normalizeRestaurantSwitcherName(`\t${restaurantName}\n`), restaurantName);
});
