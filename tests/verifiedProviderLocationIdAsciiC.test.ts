import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimVerifiedProviderLocationIdToken,
  canonicalizeVerifiedProviderLocationIdToken,
  normalizeVerifiedProviderLocationId
} from "../services/repositories/verifiedProviderLocationIdIdentity";

const identitySource = readFileSync(
  new URL("../services/repositories/verifiedProviderLocationIdIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const locationId = "L1ABCXYZ";
const accentedId = "Café-Loc-1";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SX pins verified-provider mapping providerLocationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005SX/);
  assert.match(repositorySource, /MISE-005SX/);

  assert.match(
    identitySource,
    /export function asciiTrimVerifiedProviderLocationIdToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    repositorySource,
    /from "\.\/verifiedProviderLocationIdIdentity"/
  );
  assert.match(
    repositorySource,
    /normalizeVerifiedProviderLocationId\(/
  );

  const fetchStart = repositorySource.indexOf(
    "async function fetchVerifiedProviderMappings("
  );
  const fetchEnd = repositorySource.indexOf(
    "async function loadRestaurantTaskDependencyIds("
  );
  assert.ok(fetchStart > 0 && fetchEnd > fetchStart);
  const fetchBody = repositorySource.slice(fetchStart, fetchEnd);
  assert.match(fetchBody, /normalizeVerifiedProviderLocationId\(/);
  assert.doesNotMatch(
    fetchBody,
    /external_location_id \?\? ""\)\.trim\(\)/
  );
  assert.doesNotMatch(
    fetchBody,
    /pos_locations\?\.external_location_id \?\? ""\)\.trim\(\)/
  );
  // Leave sourcePos hydrate on its existing Unicode trim contract for a
  // separate tip.
  assert.match(
    fetchBody,
    /sourcePos: String\(row\.pos_locations\?\.pos_integrations\?\.provider \?\? ""\)\.trim\(\)/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /recipeAuthorityMenuItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identityCode, /exportRestaurantDataErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /accountDeletionErrorMessageIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary verified provider location ids stable", () => {
  assert.equal(asciiTrimVerifiedProviderLocationIdToken(`  ${locationId}  `), locationId);
  assert.equal(asciiTrimVerifiedProviderLocationIdToken(`\t${locationId}\n`), locationId);
  assert.equal(canonicalizeVerifiedProviderLocationIdToken(`  ${locationId}  `), locationId);
  assert.equal(normalizeVerifiedProviderLocationId(`  ${locationId}  `), locationId);

  assert.equal(normalizeVerifiedProviderLocationId(accentedId), accentedId);
  assert.equal(canonicalizeVerifiedProviderLocationIdToken(accentedId), accentedId);
});

test("Unicode em-space / NBSP padding cannot invent clean verified provider location ids", () => {
  const padded = `${em}${locationId}${em}`;
  const nbspId = `${nbsp}${locationId}${nbsp}`;
  const internalEm = `L1${em}ABCXYZ`;
  const internalNbsp = `L1${nbsp}ABCXYZ`;

  // Inventing proof: Unicode trim would invent the clean location id.
  assert.equal(padded.trim(), locationId);
  assert.equal(nbspId.trim(), locationId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimVerifiedProviderLocationIdToken(padded), padded);
  assert.equal(canonicalizeVerifiedProviderLocationIdToken(padded), null);
  assert.equal(canonicalizeVerifiedProviderLocationIdToken(nbspId), null);
  assert.equal(normalizeVerifiedProviderLocationId(padded), null);
  assert.equal(normalizeVerifiedProviderLocationId(nbspId), null);

  // Soft empty still fails closed without inventing a location id from padding alone.
  assert.equal(normalizeVerifiedProviderLocationId(`${em}${em}`), null);
  assert.equal(normalizeVerifiedProviderLocationId(`${nbsp}`), null);
  assert.equal(normalizeVerifiedProviderLocationId("   "), null);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeVerifiedProviderLocationIdToken(internalEm), internalEm);
  assert.equal(normalizeVerifiedProviderLocationId(internalNbsp), internalNbsp);
  assert.equal(normalizeVerifiedProviderLocationId(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for verified provider location ids", () => {
  assert.equal(normalizeVerifiedProviderLocationId(undefined), null);
  assert.equal(normalizeVerifiedProviderLocationId(null), null);
  assert.equal(normalizeVerifiedProviderLocationId(""), null);
  assert.equal(normalizeVerifiedProviderLocationId("   "), null);
  assert.equal(normalizeVerifiedProviderLocationId(123 as unknown as string), null);
  assert.equal(normalizeVerifiedProviderLocationId(`\u0001${locationId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeVerifiedProviderLocationId(`${locationId}\t`), locationId);
  assert.equal(normalizeVerifiedProviderLocationId(`${locationId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeVerifiedProviderLocationId(em), null);
});
