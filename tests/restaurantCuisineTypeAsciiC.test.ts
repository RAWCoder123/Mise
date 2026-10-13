import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantCuisineTypeToken,
  canonicalizeRestaurantCuisineType,
  canonicalizeRestaurantCuisineTypeToken,
  normalizeCanonicalRestaurantCuisineType,
  requireCanonicalRestaurantCuisineType
} from "../services/domain/restaurantCuisineTypeIdentity";
import { requireRestaurantCuisineType } from "../services/miseValidation";
import { RESTAURANT_CUISINE_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantCuisineTypeIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const demoSource = readFileSync(
  new URL("../services/repositories/demoRepository.ts", import.meta.url),
  "utf8"
);
const sessionSource = readFileSync(
  new URL("../contexts/MiseSessionContext.tsx", import.meta.url),
  "utf8"
);

const cuisine = "Italian";
const accentedCuisine = "Méxicana";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PH pins restaurant cuisine_type to ASCII C", () => {
  assert.match(identitySource, /MISE-005PH/);
  assert.match(validationSource, /MISE-005PH/);
  assert.match(demoSource, /MISE-005PH/);
  assert.match(sessionSource, /MISE-005PH/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantCuisineTypeToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /normalizeCanonicalRestaurantCuisineType\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/restaurantCuisineTypeIdentity"/
  );
  assert.doesNotMatch(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantCuisineType("),
      validationSource.indexOf("export function requireRestaurantCuisineType(") + 400
    ),
    /value\.trim\(\)/
  );

  assert.match(demoSource, /canonicalizeRestaurantCuisineType\(cuisineType\)/);
  assert.doesNotMatch(demoSource, /cuisineType\?\.trim\(\) \|\| restaurant\.cuisine_type/);

  assert.match(
    sessionSource,
    /canonicalizeRestaurantCuisineType\(profile\.cuisine_type\)/
  );
  assert.doesNotMatch(
    sessionSource,
    /cuisine_type: profile\.cuisine_type\?\.trim\(\) \|\| nextRestaurant\.cuisine_type/
  );

  // Leave sibling restaurant-name inventing and presentation emptiness alone.
  assert.match(validationSource, /export function requireRestaurantName\(/);
  assert.match(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantName("),
      validationSource.indexOf("export function requireRestaurantName(") + 350
    ),
    /value\.trim\(\)/
  );
  assert.match(sessionSource, /name: profile\.name\?\.trim\(\) \|\| nextRestaurant\.name/);

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantMemoryScopeSourceIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
  assert.doesNotMatch(identitySource, /setupAttachment/);
});

test("ASCII C prep keeps ordinary restaurant cuisine types stable", () => {
  assert.equal(asciiTrimRestaurantCuisineTypeToken(`  ${cuisine}  `), cuisine);
  assert.equal(asciiTrimRestaurantCuisineTypeToken(`\t${cuisine}\n`), cuisine);
  assert.equal(canonicalizeRestaurantCuisineTypeToken(`  ${cuisine}  `), cuisine);
  assert.equal(canonicalizeRestaurantCuisineType(`  ${cuisine}  `), cuisine);
  assert.equal(normalizeCanonicalRestaurantCuisineType(`  ${cuisine}  `), cuisine);
  assert.equal(requireCanonicalRestaurantCuisineType(`  ${cuisine}  `), cuisine);
  assert.equal(requireRestaurantCuisineType(`  ${cuisine}  `), cuisine);

  assert.equal(canonicalizeRestaurantCuisineType(accentedCuisine), accentedCuisine);
  assert.equal(requireRestaurantCuisineType(accentedCuisine), accentedCuisine);

  assert.equal(requireRestaurantCuisineType(null), null);
  assert.equal(requireRestaurantCuisineType(undefined), null);
  assert.equal(requireRestaurantCuisineType(""), null);
  assert.equal(requireRestaurantCuisineType("   "), null);
});

test("Unicode em-space / NBSP padding cannot invent clean cuisine types", () => {
  const padded = `${em}${cuisine}${em}`;
  const nbspCuisine = `${nbsp}${cuisine}${nbsp}`;
  const internalEm = `Ital${em}ian`;
  const internalNbsp = `Ital${nbsp}ian`;

  // Inventing proof: Unicode trim would invent the clean cuisine.
  assert.equal(padded.trim(), cuisine);
  assert.equal(nbspCuisine.trim(), cuisine);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRestaurantCuisineTypeToken(padded), padded);
  assert.equal(canonicalizeRestaurantCuisineTypeToken(padded), null);
  assert.equal(canonicalizeRestaurantCuisineTypeToken(nbspCuisine), null);
  assert.equal(canonicalizeRestaurantCuisineType(padded), null);
  assert.equal(canonicalizeRestaurantCuisineType(nbspCuisine), null);

  assert.throws(
    () => normalizeCanonicalRestaurantCuisineType(padded),
    /Cuisine type must be text or empty\./
  );
  assert.throws(
    () => requireCanonicalRestaurantCuisineType(nbspCuisine),
    /Cuisine type must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantCuisineType(padded),
    /Cuisine type must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantCuisineType(nbspCuisine),
    /Cuisine type must be text or empty\./
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRestaurantCuisineTypeToken(internalEm), internalEm);
  assert.equal(canonicalizeRestaurantCuisineType(internalNbsp), internalNbsp);
  assert.equal(requireRestaurantCuisineType(internalEm), internalEm);
});

test("soft empty cuisine stays null without inventing text; over-long fails closed", () => {
  assert.equal(normalizeCanonicalRestaurantCuisineType(undefined), null);
  assert.equal(normalizeCanonicalRestaurantCuisineType(""), null);
  assert.equal(normalizeCanonicalRestaurantCuisineType("   "), null);
  assert.equal(normalizeCanonicalRestaurantCuisineType(`${em}${em}`), null);
  assert.equal(normalizeCanonicalRestaurantCuisineType(`${nbsp}`), null);
  assert.equal(canonicalizeRestaurantCuisineType(`${em}${em}`), null);
  assert.equal(requireRestaurantCuisineType(`${em}${em}`), null);

  assert.throws(
    () => requireCanonicalRestaurantCuisineType(`${em}${em}`),
    /Cuisine type must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantCuisineType(123),
    /Cuisine type must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantCuisineType(`\u0001${cuisine}`),
    /Cuisine type must be text or empty\./
  );

  const overLong = "a".repeat(RESTAURANT_CUISINE_MAX_CHARACTERS + 1);
  assert.throws(
    () => requireRestaurantCuisineType(overLong),
    /Cuisine type is limited to 120 characters\./
  );
  assert.equal(
    requireRestaurantCuisineType("a".repeat(RESTAURANT_CUISINE_MAX_CHARACTERS)),
    "a".repeat(RESTAURANT_CUISINE_MAX_CHARACTERS)
  );
});
