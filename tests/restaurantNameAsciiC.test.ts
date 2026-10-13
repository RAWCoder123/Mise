import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantNameToken,
  canonicalizeRestaurantName,
  canonicalizeRestaurantNameToken,
  normalizeCanonicalRestaurantName,
  requireCanonicalRestaurantName
} from "../services/domain/restaurantNameIdentity";
import { requireRestaurantName } from "../services/miseValidation";
import { RESTAURANT_NAME_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantNameIdentity.ts", import.meta.url),
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

const restaurantName = "Bistro Nova";
const accentedName = "Café Méxicana";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PJ pins restaurant name to ASCII C", () => {
  assert.match(identitySource, /MISE-005PJ/);
  assert.match(validationSource, /MISE-005PJ/);
  assert.match(demoSource, /MISE-005PJ/);
  assert.match(sessionSource, /MISE-005PJ/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantNameToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /normalizeCanonicalRestaurantName\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/restaurantNameIdentity"/
  );
  assert.doesNotMatch(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantName("),
      validationSource.indexOf("export function requireRestaurantName(") + 400
    ),
    /value\.trim\(\)/
  );

  assert.match(demoSource, /canonicalizeRestaurantName\(name\)/);
  assert.doesNotMatch(demoSource, /name\.trim\(\) \|\| restaurant\.name/);

  assert.match(
    sessionSource,
    /canonicalizeRestaurantName\(profile\.name\)/
  );
  assert.doesNotMatch(
    sessionSource,
    /name: profile\.name\?\.trim\(\) \|\| nextRestaurant\.name/
  );

  // Leave sibling cuisine inventing and presentation emptiness alone.
  assert.match(validationSource, /export function requireRestaurantCuisineType\(/);
  assert.match(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantCuisineType("),
      validationSource.indexOf("export function requireRestaurantCuisineType(") + 350
    ),
    /value\.trim\(\)/
  );
  assert.match(
    sessionSource,
    /cuisine_type: profile\.cuisine_type\?\.trim\(\) \|\| nextRestaurant\.cuisine_type/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantCuisineTypeIdentity/);
  assert.doesNotMatch(identitySource, /setupAttachmentLabelIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
  assert.doesNotMatch(identitySource, /from "\.\/demoDataset"/);
});

test("ASCII C prep keeps ordinary restaurant names stable", () => {
  assert.equal(asciiTrimRestaurantNameToken(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimRestaurantNameToken(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeRestaurantNameToken(`  ${restaurantName}  `), restaurantName);
  assert.equal(canonicalizeRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeCanonicalRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(requireCanonicalRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(requireRestaurantName(`  ${restaurantName}  `), restaurantName);

  assert.equal(canonicalizeRestaurantName(accentedName), accentedName);
  assert.equal(requireRestaurantName(accentedName), accentedName);
});

test("Unicode em-space / NBSP padding cannot invent clean restaurant names", () => {
  const padded = `${em}${restaurantName}${em}`;
  const nbspName = `${nbsp}${restaurantName}${nbsp}`;
  const internalEm = `Bistro${em}Nova`;
  const internalNbsp = `Bistro${nbsp}Nova`;

  // Inventing proof: Unicode trim would invent the clean restaurant name.
  assert.equal(padded.trim(), restaurantName);
  assert.equal(nbspName.trim(), restaurantName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRestaurantNameToken(padded), padded);
  assert.equal(canonicalizeRestaurantNameToken(padded), null);
  assert.equal(canonicalizeRestaurantNameToken(nbspName), null);
  assert.equal(canonicalizeRestaurantName(padded), null);
  assert.equal(canonicalizeRestaurantName(nbspName), null);

  assert.throws(
    () => normalizeCanonicalRestaurantName(padded),
    /Restaurant name is required\./
  );
  assert.throws(
    () => requireCanonicalRestaurantName(nbspName),
    /Restaurant name is required\./
  );
  assert.throws(
    () => requireRestaurantName(padded),
    /Restaurant name is required\./
  );
  assert.throws(
    () => requireRestaurantName(nbspName),
    /Restaurant name is required\./
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRestaurantNameToken(internalEm), internalEm);
  assert.equal(canonicalizeRestaurantName(internalNbsp), internalNbsp);
  assert.equal(requireRestaurantName(internalEm), internalEm);
});

test("soft empty name fails closed on require; soft canonicalize stays null; over-long fails", () => {
  assert.equal(canonicalizeRestaurantName(undefined), null);
  assert.equal(canonicalizeRestaurantName(""), null);
  assert.equal(canonicalizeRestaurantName("   "), null);
  assert.equal(canonicalizeRestaurantName(`${em}${em}`), null);
  assert.equal(canonicalizeRestaurantName(`${nbsp}`), null);

  assert.throws(
    () => normalizeCanonicalRestaurantName(""),
    /Restaurant name must be between 1 and 120 characters\./
  );
  assert.throws(
    () => requireRestaurantName("   "),
    /Restaurant name must be between 1 and 120 characters\./
  );
  assert.throws(
    () => requireRestaurantName(`${em}${em}`),
    /Restaurant name must be between 1 and 120 characters\./
  );
  assert.throws(
    () => requireRestaurantName(null),
    /Restaurant name is required\./
  );
  assert.throws(
    () => requireRestaurantName(123),
    /Restaurant name is required\./
  );
  assert.throws(
    () => requireRestaurantName(`\u0001${restaurantName}`),
    /Restaurant name is required\./
  );

  const overLong = "a".repeat(RESTAURANT_NAME_MAX_CHARACTERS + 1);
  assert.throws(
    () => requireRestaurantName(overLong),
    /Restaurant name must be between 1 and 120 characters\./
  );
  assert.equal(
    requireRestaurantName("a".repeat(RESTAURANT_NAME_MAX_CHARACTERS)),
    "a".repeat(RESTAURANT_NAME_MAX_CHARACTERS)
  );
});
