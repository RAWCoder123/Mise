import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantAddressToken,
  canonicalizeRestaurantAddress,
  canonicalizeRestaurantAddressToken,
  normalizeCanonicalRestaurantAddress,
  requireCanonicalRestaurantAddress
} from "../services/domain/restaurantAddressIdentity";
import {
  requireRestaurantAddress,
  requireRestaurantProfilePatch
} from "../services/miseValidation";
import { RESTAURANT_ADDRESS_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantAddressIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const address = "123 Main St";
const accentedAddress = "Calle José 12";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PP pins restaurant address to ASCII C", () => {
  assert.match(identitySource, /MISE-005PP/);
  assert.match(validationSource, /MISE-005PP/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantAddressToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /normalizeCanonicalRestaurantAddress\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/restaurantAddressIdentity"/
  );
  assert.match(
    validationSource,
    /patch\.address = requireRestaurantAddress\(patch\.address\)/
  );

  const requireSlice = validationSource.slice(
    validationSource.indexOf("export function requireRestaurantAddress("),
    validationSource.indexOf("export function requireRestaurantAddress(") + 350
  );
  assert.doesNotMatch(requireSlice, /value\.trim\(\)/);
  assert.doesNotMatch(requireSlice, /requireNullableBoundedText/);

  // Leave sibling name / cuisine inventing and notes helper alone on main.
  assert.match(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantName("),
      validationSource.indexOf("export function requireRestaurantName(") + 350
    ),
    /value\.trim\(\)/
  );
  assert.match(
    validationSource.slice(
      validationSource.indexOf("export function requireRestaurantCuisineType("),
      validationSource.indexOf("export function requireRestaurantCuisineType(") + 350
    ),
    /value\.trim\(\)/
  );
  assert.match(validationSource, /function requireNullableBoundedText\(/);
  assert.match(
    validationSource,
    /RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantCuisineTypeIdentity/);
  assert.doesNotMatch(identitySource, /userProfileNameIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary restaurant addresses stable", () => {
  assert.equal(asciiTrimRestaurantAddressToken(`  ${address}  `), address);
  assert.equal(asciiTrimRestaurantAddressToken(`\t${address}\n`), address);
  assert.equal(canonicalizeRestaurantAddressToken(`  ${address}  `), address);
  assert.equal(canonicalizeRestaurantAddress(`  ${address}  `), address);
  assert.equal(normalizeCanonicalRestaurantAddress(`  ${address}  `), address);
  assert.equal(requireCanonicalRestaurantAddress(`  ${address}  `), address);
  assert.equal(requireRestaurantAddress(`  ${address}  `), address);

  assert.equal(canonicalizeRestaurantAddress(accentedAddress), accentedAddress);
  assert.equal(requireRestaurantAddress(accentedAddress), accentedAddress);

  assert.equal(requireRestaurantAddress(null), null);
  assert.equal(requireRestaurantAddress(undefined), null);
  assert.equal(requireRestaurantAddress(""), null);
  assert.equal(requireRestaurantAddress("   "), null);
  assert.equal(requireRestaurantAddress(em), null);

  const patch = requireRestaurantProfilePatch({ address: `  ${address}  ` });
  assert.equal(patch.address, address);
});

test("Unicode em-space / NBSP padding cannot invent clean restaurant addresses", () => {
  const padded = `${em}${address}${em}`;
  const nbspAddress = `${nbsp}${address}${nbsp}`;
  const internalEm = `123${em}Main St`;
  const internalNbsp = `123${nbsp}Main St`;

  // Inventing proof: Unicode trim would invent the clean restaurant address.
  assert.equal(padded.trim(), address);
  assert.equal(nbspAddress.trim(), address);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRestaurantAddressToken(padded), padded);
  assert.notEqual(asciiTrimRestaurantAddressToken(padded), address);
  assert.equal(canonicalizeRestaurantAddressToken(padded), null);
  assert.equal(canonicalizeRestaurantAddress(padded), null);
  assert.throws(
    () => normalizeCanonicalRestaurantAddress(padded),
    /Restaurant address must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantAddress(padded),
    /Restaurant address must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ address: padded }),
    /Restaurant address must be text or empty\./
  );

  assert.equal(canonicalizeRestaurantAddressToken(nbspAddress), null);
  assert.throws(
    () => requireRestaurantAddress(nbspAddress),
    /Restaurant address must be text or empty\./
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeRestaurantAddressToken(internalEm), internalEm);
  assert.equal(canonicalizeRestaurantAddress(internalNbsp), internalNbsp);
  assert.equal(requireRestaurantAddress(internalEm), internalEm);

  // Soft empty stays soft-null; over-long and controls fail closed.
  assert.equal(requireRestaurantAddress(`${em}${em}`), null);
  assert.throws(
    () => requireRestaurantAddress("a".repeat(RESTAURANT_ADDRESS_MAX_CHARACTERS + 1)),
    new RegExp(
      `Restaurant address is limited to ${RESTAURANT_ADDRESS_MAX_CHARACTERS} characters\\.`
    )
  );
  assert.throws(
    () => requireRestaurantAddress(`line1\nline2`),
    /Restaurant address must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantAddress(42),
    /Restaurant address must be text or empty\./
  );
});

test("MISE-005PP address prep does not rewrite profile notes helper", () => {
  const notesHelper = validationSource.slice(
    validationSource.indexOf("function requireNullableBoundedText("),
    validationSource.indexOf("function requireNullableBoundedText(") + 280
  );
  assert.match(notesHelper, /value\.trim\(\)/);

  const notesCall = validationSource.slice(
    validationSource.indexOf("notes: requireNullableBoundedText("),
    validationSource.indexOf("notes: requireNullableBoundedText(") + 220
  );
  assert.match(notesCall, /requireNullableBoundedText/);
  assert.match(notesCall, /profile\.notes,/);
  assert.match(notesCall, /RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS/);
});
