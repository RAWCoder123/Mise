import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSettingsProfileRestaurantName,
  canonicalizeSettingsProfileRestaurantName,
  normalizeSettingsProfileRestaurantName
} from "../services/domain/presentationSettingsProfileRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSettingsProfileRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const settingsSource = readFileSync(new URL("../app/(tabs)/settings.tsx", import.meta.url), "utf8");

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VM pins Settings profile restaurant name to ASCII C", () => {
  assert.match(identitySource, /MISE-005VM/);
  assert.match(settingsSource, /MISE-005VM/);

  assert.match(
    identitySource,
    /export function asciiTrimSettingsProfileRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    settingsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSettingsProfileRestaurantNameIdentity"/
  );
  assert.match(settingsSource, /normalizeSettingsProfileRestaurantName\(/);
  assert.match(
    settingsSource,
    /normalizeSettingsProfileRestaurantName\(restaurant\?\.name\) \|\|\s*t\("settings\.profile\.noRestaurant"\)/
  );
  assert.doesNotMatch(
    settingsSource,
    /restaurant\?\.name \?\? t\("settings\.profile\.noRestaurant"\)/
  );

  // Leave sibling Settings / workspace fields and other restaurant-name tips alone.
  assert.match(
    settingsSource,
    /user\?\.email\?\.trim\(\) \|\| t\("settings\.account\.emailMissing"\)/
  );
  assert.match(
    settingsSource,
    /user\?\.name\?\.trim\(\) \|\| t\("settings\.account\.title"\)/
  );
  assert.match(
    settingsSource,
    /item\.cuisine_type \?\? t\("settings\.workspace\.metaFallback"\)/
  );
  assert.match(settingsSource, /\{item\.name\}/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationInsightsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationSettingsAccountEmailLabelIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Settings profile restaurant names stable", () => {
  assert.equal(asciiTrimSettingsProfileRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimSettingsProfileRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeSettingsProfileRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSettingsProfileRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSettingsProfileRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Settings noRestaurant fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";
  // Simulate the prior `??` row with a typed nullable candidate so empty
  // string remains a reachable non-nullish bypass in TypeScript.
  const priorDisplay = (value: string | null | undefined) => value ?? "FALLBACK";

  // Bypass proof: non-nullish Unicode-only space / empty string skip ?? fallback.
  assert.equal(priorDisplay(unicodeOnly), unicodeOnly);
  assert.equal(priorDisplay(nbspOnly), nbspOnly);
  assert.equal(priorDisplay(empty), empty);
  assert.notEqual(priorDisplay(unicodeOnly), "FALLBACK");
  assert.notEqual(priorDisplay(empty), "FALLBACK");

  // Soft-null restores the intentional localized noRestaurant fallback.
  assert.equal(normalizeSettingsProfileRestaurantName(unicodeOnly), null);
  assert.equal(normalizeSettingsProfileRestaurantName(nbspOnly), null);
  assert.equal(normalizeSettingsProfileRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsProfileRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSettingsProfileRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Settings profile restaurant names", () => {
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
  assert.equal(asciiTrimSettingsProfileRestaurantName(padded), padded);
  assert.equal(canonicalizeSettingsProfileRestaurantName(padded), null);
  assert.equal(canonicalizeSettingsProfileRestaurantName(nbspName), null);
  assert.equal(normalizeSettingsProfileRestaurantName(padded), null);
  assert.equal(normalizeSettingsProfileRestaurantName(nbspName), null);
  assert.equal(normalizeSettingsProfileRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSettingsProfileRestaurantName(internalEm), internalEm);
  assert.equal(normalizeSettingsProfileRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeSettingsProfileRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Settings profile restaurant name", () => {
  assert.equal(normalizeSettingsProfileRestaurantName(undefined), null);
  assert.equal(normalizeSettingsProfileRestaurantName(null), null);
  assert.equal(normalizeSettingsProfileRestaurantName(""), null);
  assert.equal(normalizeSettingsProfileRestaurantName("   "), null);
  assert.equal(normalizeSettingsProfileRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeSettingsProfileRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSettingsProfileRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeSettingsProfileRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeSettingsProfileRestaurantName(em), null);
});
