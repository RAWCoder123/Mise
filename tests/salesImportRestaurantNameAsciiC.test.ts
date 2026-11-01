import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSalesImportRestaurantName,
  canonicalizeSalesImportRestaurantName,
  normalizeSalesImportRestaurantName
} from "../services/domain/presentationSalesImportRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSalesImportRestaurantNameIdentity.ts", import.meta.url),
  "utf8"
);
const salesImportSource = readFileSync(
  new URL("../app/settings/sales-import.tsx", import.meta.url),
  "utf8"
);

const restaurantName = "Luna Bistro";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VN pins Sales Import hero restaurant name to ASCII C", () => {
  assert.match(identitySource, /MISE-005VN/);
  assert.match(salesImportSource, /MISE-005VN/);

  assert.match(
    identitySource,
    /export function asciiTrimSalesImportRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    salesImportSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSalesImportRestaurantNameIdentity"/
  );
  assert.match(salesImportSource, /normalizeSalesImportRestaurantName\(/);
  assert.match(
    salesImportSource,
    /normalizeSalesImportRestaurantName\(restaurant\?\.name\) \|\|\s*t\("common\.notSet"\)/
  );
  assert.doesNotMatch(
    salesImportSource,
    /restaurant\?\.name \?\? t\("common\.notSet"\)/
  );

  // Leave sibling Sales Import copy and unrelated restaurant-name tips alone.
  assert.match(salesImportSource, /t\("salesImport\.title"\)/);
  assert.match(salesImportSource, /t\("salesImport\.missingRestaurant\.title"\)/);
  assert.match(salesImportSource, /t\("salesImport\.restricted\.title"\)/);

  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /presentationSettingsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationInsightsProfileRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationTodayScreenTitleIdentity/);
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Sales Import restaurant names stable", () => {
  assert.equal(asciiTrimSalesImportRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimSalesImportRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeSalesImportRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSalesImportRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSalesImportRestaurantName("Harbor Cafe"), "Harbor Cafe");
});

test("Unicode-only space cannot bypass the localized Sales Import notSet fallback", () => {
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

  // Soft-null restores the intentional localized notSet fallback.
  assert.equal(normalizeSalesImportRestaurantName(unicodeOnly), null);
  assert.equal(normalizeSalesImportRestaurantName(nbspOnly), null);
  assert.equal(normalizeSalesImportRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSalesImportRestaurantName("   ") || "FALLBACK", "FALLBACK");
  assert.equal(normalizeSalesImportRestaurantName(empty) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean Sales Import restaurant names", () => {
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
  assert.equal(asciiTrimSalesImportRestaurantName(padded), padded);
  assert.equal(canonicalizeSalesImportRestaurantName(padded), null);
  assert.equal(canonicalizeSalesImportRestaurantName(nbspName), null);
  assert.equal(normalizeSalesImportRestaurantName(padded), null);
  assert.equal(normalizeSalesImportRestaurantName(nbspName), null);
  assert.equal(normalizeSalesImportRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSalesImportRestaurantName(internalEm), internalEm);
  assert.equal(normalizeSalesImportRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeSalesImportRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Sales Import restaurant name", () => {
  assert.equal(normalizeSalesImportRestaurantName(undefined), null);
  assert.equal(normalizeSalesImportRestaurantName(null), null);
  assert.equal(normalizeSalesImportRestaurantName(""), null);
  assert.equal(normalizeSalesImportRestaurantName("   "), null);
  assert.equal(normalizeSalesImportRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeSalesImportRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSalesImportRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeSalesImportRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeSalesImportRestaurantName(em), null);
});
