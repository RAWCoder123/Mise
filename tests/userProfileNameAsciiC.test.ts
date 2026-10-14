import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimUserProfileNameToken,
  canonicalizeUserProfileName,
  canonicalizeUserProfileNameToken,
  normalizeCanonicalUserProfileName,
  requireCanonicalUserProfileName
} from "../services/domain/userProfileNameIdentity";
import { PROFILE_NAME_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/userProfileNameIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/restaurant.ts", import.meta.url),
  "utf8"
);
const securityLimitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);
const moreSource = readFileSync(
  new URL("../app/(tabs)/more.tsx", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const profileName = "Alex Rivera";
const accentedName = "José García";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PO pins user profile display name to ASCII C", () => {
  assert.match(identitySource, /MISE-005PO/);
  assert.match(applicationSource, /MISE-005PO/);
  assert.match(securityLimitsSource, /PROFILE_NAME_MAX_CHARACTERS = 120/);

  assert.match(
    identitySource,
    /export function asciiTrimUserProfileNameToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /normalizeCanonicalUserProfileName\(name\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/userProfileNameIdentity"/
  );
  assert.doesNotMatch(
    applicationSource.slice(
      applicationSource.indexOf("export async function updateMyProfile("),
      applicationSource.indexOf("export async function updateMyProfile(") + 350
    ),
    /name\.trim\(\)/
  );

  // Leave sibling presentation emptiness and restaurant-name inventing alone.
  assert.match(moreSource, /user\?\.name\?\.trim\(\)/);
  assert.match(validationSource, /export function requireRestaurantName\(/);
  assert.doesNotMatch(validationSource, /requireProfileName/);

  // Do not rewrite sibling tips / modules / hosted SQL.
  assert.doesNotMatch(identitySource, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /users_name_check/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
  assert.doesNotMatch(identitySource, /create or replace function/i);
  assert.doesNotMatch(applicationSource, /requireProfileName/);
});

test("ASCII C prep keeps ordinary operator profile names stable", () => {
  assert.equal(asciiTrimUserProfileNameToken(`  ${profileName}  `), profileName);
  assert.equal(asciiTrimUserProfileNameToken(`\t${profileName}\n`), profileName);
  assert.equal(canonicalizeUserProfileNameToken(`  ${profileName}  `), profileName);
  assert.equal(canonicalizeUserProfileName(`  ${profileName}  `), profileName);
  assert.equal(normalizeCanonicalUserProfileName(`  ${profileName}  `), profileName);
  assert.equal(requireCanonicalUserProfileName(`  ${profileName}  `), profileName);

  assert.equal(canonicalizeUserProfileName(accentedName), accentedName);
  assert.equal(normalizeCanonicalUserProfileName(accentedName), accentedName);
});

test("Unicode em-space / NBSP padding cannot invent clean profile names", () => {
  const padded = `${em}${profileName}${em}`;
  const nbspName = `${nbsp}${profileName}${nbsp}`;
  const internalEm = `Alex${em}Rivera`;
  const internalNbsp = `Alex${nbsp}Rivera`;

  // Inventing proof: Unicode trim would invent the clean operator display name.
  assert.equal(padded.trim(), profileName);
  assert.equal(nbspName.trim(), profileName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimUserProfileNameToken(padded), padded);
  assert.equal(canonicalizeUserProfileNameToken(padded), null);
  assert.equal(canonicalizeUserProfileNameToken(nbspName), null);
  assert.equal(canonicalizeUserProfileName(padded), null);
  assert.equal(canonicalizeUserProfileName(nbspName), null);

  assert.throws(
    () => normalizeCanonicalUserProfileName(padded),
    /Profile name is required\./
  );
  assert.throws(
    () => requireCanonicalUserProfileName(nbspName),
    /Profile name is required\./
  );

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeUserProfileNameToken(internalEm), internalEm);
  assert.equal(canonicalizeUserProfileName(internalNbsp), internalNbsp);
  assert.equal(normalizeCanonicalUserProfileName(internalEm), internalEm);
});

test("soft empty name fails closed on require; soft canonicalize stays null; over-long fails", () => {
  assert.equal(canonicalizeUserProfileName(undefined), null);
  assert.equal(canonicalizeUserProfileName(""), null);
  assert.equal(canonicalizeUserProfileName("   "), null);
  assert.equal(canonicalizeUserProfileName(`${em}${em}`), null);
  assert.equal(canonicalizeUserProfileName(`${nbsp}`), null);

  assert.throws(
    () => normalizeCanonicalUserProfileName(""),
    /Profile name must be between 1 and 120 characters\./
  );
  assert.throws(
    () => normalizeCanonicalUserProfileName("   "),
    /Profile name must be between 1 and 120 characters\./
  );
  assert.throws(
    () => normalizeCanonicalUserProfileName(`${em}${em}`),
    /Profile name must be between 1 and 120 characters\./
  );
  assert.throws(
    () => normalizeCanonicalUserProfileName(null),
    /Profile name is required\./
  );
  assert.throws(
    () => normalizeCanonicalUserProfileName(123),
    /Profile name is required\./
  );
  assert.throws(
    () => normalizeCanonicalUserProfileName(`\u0001${profileName}`),
    /Profile name is required\./
  );

  const overLong = "a".repeat(PROFILE_NAME_MAX_CHARACTERS + 1);
  assert.throws(
    () => normalizeCanonicalUserProfileName(overLong),
    /Profile name must be between 1 and 120 characters\./
  );
  assert.equal(
    normalizeCanonicalUserProfileName("a".repeat(PROFILE_NAME_MAX_CHARACTERS)),
    "a".repeat(PROFILE_NAME_MAX_CHARACTERS)
  );
});
