import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantLogoUrlToken,
  canonicalizeRestaurantLogoUrl,
  canonicalizeRestaurantLogoUrlToken,
  normalizeCanonicalRestaurantLogoUrl,
  requireCanonicalRestaurantLogoUrl
} from "../services/domain/restaurantLogoUrlIdentity";
import {
  requireHttpsLogoUrl,
  requireRestaurantProfilePatch
} from "../services/miseValidation";
import { RESTAURANT_LOGO_URL_MAX_CHARACTERS } from "../services/domain/securityLimits";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantLogoUrlIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const logoUrl = "https://cdn.example.com/logo.png";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005PS pins restaurant logo URL to ASCII C", () => {
  assert.match(identitySource, /MISE-005PS/);
  assert.match(validationSource, /MISE-005PS/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantLogoUrlToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /normalizeCanonicalRestaurantLogoUrl\(value\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/restaurantLogoUrlIdentity"/
  );
  assert.match(
    validationSource,
    /patch\.logo_url = requireHttpsLogoUrl\(patch\.logo_url\)/
  );

  const requireSlice = validationSource.slice(
    validationSource.indexOf("export function requireHttpsLogoUrl("),
    validationSource.indexOf("export function requireHttpsLogoUrl(") + 350
  );
  assert.doesNotMatch(requireSlice, /value\.trim\(\)/);
  assert.doesNotMatch(requireSlice, /requireNullableBoundedText/);

  // Leave sibling address / notes inventing on requireNullableBoundedText on main.
  assert.match(
    validationSource.slice(
      validationSource.indexOf("if (patch.address !== undefined)"),
      validationSource.indexOf("if (patch.address !== undefined)") + 220
    ),
    /requireNullableBoundedText/
  );
  assert.match(
    validationSource.slice(
      validationSource.indexOf("notes: requireNullableBoundedText("),
      validationSource.indexOf("notes: requireNullableBoundedText(") + 220
    ),
    /requireNullableBoundedText/
  );
  assert.match(validationSource, /function requireNullableBoundedText\(/);
  assert.match(
    validationSource.slice(
      validationSource.indexOf("function requireNullableBoundedText("),
      validationSource.indexOf("function requireNullableBoundedText(") + 280
    ),
    /value\.trim\(\)/
  );

  // Leave sibling name / cuisine inventing alone on main.
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

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /restaurantAddressIdentity/);
  assert.doesNotMatch(identitySource, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /restaurantCuisineTypeIdentity/);
  assert.doesNotMatch(identitySource, /operationalProfileNotesIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary restaurant logo URLs stable", () => {
  assert.equal(asciiTrimRestaurantLogoUrlToken(`  ${logoUrl}  `), logoUrl);
  assert.equal(asciiTrimRestaurantLogoUrlToken(`\t${logoUrl}\n`), logoUrl);
  assert.equal(canonicalizeRestaurantLogoUrlToken(`  ${logoUrl}  `), logoUrl);
  assert.equal(canonicalizeRestaurantLogoUrl(`  ${logoUrl}  `), logoUrl);
  assert.equal(normalizeCanonicalRestaurantLogoUrl(`  ${logoUrl}  `), logoUrl);
  assert.equal(requireCanonicalRestaurantLogoUrl(`  ${logoUrl}  `), logoUrl);
  assert.equal(requireHttpsLogoUrl(`  ${logoUrl}  `), logoUrl);

  assert.equal(requireHttpsLogoUrl(null), null);
  assert.equal(requireHttpsLogoUrl(undefined), null);
  assert.equal(requireHttpsLogoUrl(""), null);
  assert.equal(requireHttpsLogoUrl("   "), null);
  assert.equal(requireHttpsLogoUrl(em), null);

  const patch = requireRestaurantProfilePatch({ logo_url: `  ${logoUrl}  ` });
  assert.equal(patch.logo_url, logoUrl);
});

test("Unicode em-space / NBSP padding cannot invent clean restaurant logo URLs", () => {
  const padded = `${em}${logoUrl}${em}`;
  const nbspLogo = `${nbsp}${logoUrl}${nbsp}`;
  const internalEm = `https://cdn.example.com/logo${em}.png`;
  const internalNbsp = `https://cdn.example.com/logo${nbsp}.png`;

  // Inventing proof: Unicode trim would invent the clean HTTPS logo URL.
  assert.equal(padded.trim(), logoUrl);
  assert.equal(nbspLogo.trim(), logoUrl);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimRestaurantLogoUrlToken(padded), padded);
  assert.notEqual(asciiTrimRestaurantLogoUrlToken(padded), logoUrl);
  assert.equal(canonicalizeRestaurantLogoUrlToken(padded), null);
  assert.equal(canonicalizeRestaurantLogoUrl(padded), null);
  assert.throws(
    () => normalizeCanonicalRestaurantLogoUrl(padded),
    /Logo URL must be text or empty\./
  );
  assert.throws(
    () => requireHttpsLogoUrl(padded),
    /Logo URL must be text or empty\./
  );
  assert.throws(
    () => requireRestaurantProfilePatch({ logo_url: padded }),
    /Logo URL must be text or empty\./
  );

  assert.equal(canonicalizeRestaurantLogoUrlToken(nbspLogo), null);
  assert.throws(
    () => requireHttpsLogoUrl(nbspLogo),
    /Logo URL must be text or empty\./
  );

  // Internal Unicode spaces are not end-stripped; they remain durable content
  // when the HTTPS hostname/protocol contract still holds (path may carry
  // operator-entered Unicode). End-padding inventing is what this tip refuses.
  assert.equal(canonicalizeRestaurantLogoUrlToken(internalEm), internalEm);
  assert.equal(canonicalizeRestaurantLogoUrl(internalNbsp), internalNbsp);
  assert.equal(requireHttpsLogoUrl(internalEm), internalEm);
  assert.equal(requireHttpsLogoUrl(internalNbsp), internalNbsp);

  // Soft empty stays soft-null; over-long, controls, and non-HTTPS fail closed.
  assert.equal(requireHttpsLogoUrl(`${em}${em}`), null);
  assert.throws(
    () =>
      requireHttpsLogoUrl(
        `https://example.test/${"a".repeat(RESTAURANT_LOGO_URL_MAX_CHARACTERS)}`
      ),
    new RegExp(
      `Logo URL is limited to ${RESTAURANT_LOGO_URL_MAX_CHARACTERS} characters\\.`
    )
  );
  assert.throws(
    () => requireHttpsLogoUrl("http://example.test/logo.png"),
    /Logo URL must be a valid HTTPS URL\./
  );
  assert.throws(
    () => requireHttpsLogoUrl(`line1\nline2`),
    /Logo URL must be text or empty\./
  );
  assert.throws(
    () => requireHttpsLogoUrl(42),
    /Logo URL must be text or empty\./
  );
});

test("MISE-005PS logo URL prep does not rewrite profile notes helper", () => {
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

  const addressCall = validationSource.slice(
    validationSource.indexOf("if (patch.address !== undefined)"),
    validationSource.indexOf("if (patch.address !== undefined)") + 220
  );
  assert.match(addressCall, /requireNullableBoundedText/);
  assert.match(addressCall, /Restaurant address/);
});
