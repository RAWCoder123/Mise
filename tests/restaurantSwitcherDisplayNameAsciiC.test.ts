import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantSwitcherDisplayName,
  canonicalizeRestaurantSwitcherDisplayName,
  normalizeRestaurantSwitcherDisplayName
} from "../services/domain/presentationRestaurantSwitcherDisplayNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationRestaurantSwitcherDisplayNameIdentity.ts",
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
const restaurantSwitcherNameIdentityPath = new URL(
  "../services/domain/presentationRestaurantSwitcherNameIdentity.ts",
  import.meta.url
);

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ZN pins RestaurantSwitcher chip display restaurant name to ASCII C", () => {
  assert.match(identitySource, /MISE-005ZN/);
  assert.match(switcherSource, /MISE-005ZN/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantSwitcherDisplayName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    switcherSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationRestaurantSwitcherDisplayNameIdentity"/
  );
  assert.match(switcherSource, /normalizeRestaurantSwitcherDisplayName\(/);
  assert.match(
    switcherSource,
    /restaurantSwitcherDisplayName \|\| t\("screen\.restaurantSwitcher\.name\.none"\)/
  );
  assert.doesNotMatch(
    switcherSource,
    /styles\.label[^>]*>\s*\{name\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"screen\.restaurantSwitcher\.name\.none": "Restaurant"/);
  assert.match(catalogSource, /"screen\.restaurantSwitcher\.name\.none": "Restaurante"/);
  assert.match(catalogSource, /"screen\.restaurantSwitcher\.name\.none": "餐厅"/);

  // Leave RestaurantSwitcher a11y restaurant name alone (open #1079 / MISE-005XS).
  assert.match(
    switcherSource,
    /accessibilityLabel=\{t\("screen\.openRestaurantSettings", \{\s*restaurant: name\s*\}\)/
  );
  assert.equal(filePresence(restaurantSwitcherNameIdentityPath), "absent");

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
  assert.doesNotMatch(identityCode, /presentationRestaurantSwitcherNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAutonomySubtitleRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeRestaurantSwitcherDisplayName(restaurantName), restaurantName);
  assert.equal(normalizeRestaurantSwitcherDisplayName(` ${restaurantName} `), restaurantName);
  assert.equal(
    normalizeRestaurantSwitcherDisplayName(`Case-${restaurantName}`),
    `Case-${restaurantName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for RestaurantSwitcher display names", () => {
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
  assert.equal(asciiTrimRestaurantSwitcherDisplayName(padded), padded);
  assert.equal(canonicalizeRestaurantSwitcherDisplayName(padded), null);
  assert.equal(canonicalizeRestaurantSwitcherDisplayName(nbspName), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(padded), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(nbspName), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRestaurantSwitcherDisplayName(internalEm), internalEm);
  assert.equal(normalizeRestaurantSwitcherDisplayName(internalNbsp), internalNbsp);
  assert.equal(normalizeRestaurantSwitcherDisplayName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for RestaurantSwitcher display names", () => {
  assert.equal(normalizeRestaurantSwitcherDisplayName(undefined), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(null), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(""), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName("   "), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(123 as unknown as string), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeRestaurantSwitcherDisplayName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeRestaurantSwitcherDisplayName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(em), null);
});

test("RestaurantSwitcher display bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass path still rendered blank-looking restaurant into chip Text.
  assert.equal(normalizeRestaurantSwitcherDisplayName(""), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(em), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(nbsp), null);
  const missingName: string | null | undefined = undefined;
  const unicodeOnlyName: string | null | undefined = em;
  assert.equal(missingName ?? "", "");
  assert.equal(unicodeOnlyName ?? "", em);
  assert.notEqual(unicodeOnlyName ?? "", "");
  assert.equal(Boolean(unicodeOnlyName), true);
  assert.match(
    switcherSource,
    /restaurantSwitcherDisplayName \|\| t\("screen\.restaurantSwitcher\.name\.none"\)/
  );
});

test("RestaurantSwitcher display restaurant name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${restaurantName}${em}`;
  assert.notEqual(asciiTrimRestaurantSwitcherDisplayName(padded), padded.trim());
  assert.equal(normalizeRestaurantSwitcherDisplayName(padded), null);
  assert.equal(normalizeRestaurantSwitcherDisplayName(`\t${restaurantName}\n`), restaurantName);
});

test("RestaurantSwitcher display name soft-null owns intentional localized none copy", () => {
  assert.equal(
    normalizeRestaurantSwitcherDisplayName(em) || "Restaurant",
    "Restaurant"
  );
  assert.equal(
    normalizeRestaurantSwitcherDisplayName(nbsp) || "Restaurante",
    "Restaurante"
  );
  assert.equal(normalizeRestaurantSwitcherDisplayName("") || "餐厅", "餐厅");
  assert.match(catalogSource, /"screen\.restaurantSwitcher\.name\.none": "Restaurant"/);
  assert.match(catalogSource, /"screen\.restaurantSwitcher\.name\.none": "Restaurante"/);
  assert.match(catalogSource, /"screen\.restaurantSwitcher\.name\.none": "餐厅"/);
});
