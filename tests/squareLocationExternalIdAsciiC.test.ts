import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareLocationExternalId,
  canonicalizeSquareLocationExternalId,
  normalizeSquareLocationExternalId
} from "../services/domain/squareLocationExternalIdIdentity";
import { listSquareLocations } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareLocationExternalIdIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const locationId = "LOC_ABC123";
const accentedId = "Café-Loc-1";
const em = "\u2003";
const nbsp = "\u00a0";

function locationsFetch(payload: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
}

test("MISE-005TE pins Square location-list externalLocationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005TE/);
  assert.match(squareSource, /MISE-005TE/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareLocationExternalId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareLocationExternalIdIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareLocationExternalId\(/);

  const listStart = squareSource.indexOf("export async function listSquareLocations(");
  const listEnd = squareSource.indexOf("export async function searchSquareOrders(");
  assert.ok(listStart > 0 && listEnd > listStart);
  const listBody = squareSource.slice(listStart, listEnd);
  assert.match(listBody, /normalizeSquareLocationExternalId\(/);
  assert.doesNotMatch(listBody, /stringField\(record,\s*"id"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (display name). Leave timezone raw length gate.
  assert.match(listBody, /stringField\(record,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square location-list external ids stable", async () => {
  assert.equal(asciiTrimSquareLocationExternalId(`  ${locationId}  `), locationId);
  assert.equal(asciiTrimSquareLocationExternalId(`\t${locationId}\n`), locationId);
  assert.equal(canonicalizeSquareLocationExternalId(`  ${locationId}  `), locationId);
  assert.equal(normalizeSquareLocationExternalId(`  ${locationId}  `), locationId);

  assert.equal(normalizeSquareLocationExternalId(accentedId), accentedId);
  assert.equal(canonicalizeSquareLocationExternalId(accentedId), accentedId);

  const locations = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: `  ${locationId}  `,
          name: "Main Floor",
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(locations.length, 1);
  assert.equal(locations[0]?.externalLocationId, locationId);
  assert.equal(locations[0]?.displayName, "Main Floor");
});

test("Unicode em-space / NBSP padding cannot invent clean Square location-list external ids", async () => {
  const padded = `${em}${locationId}${em}`;
  const nbspId = `${nbsp}${locationId}${nbsp}`;
  const internalEm = `LOC${em}ABC`;
  const internalNbsp = `LOC${nbsp}ABC`;

  // Inventing proof: Unicode trim would invent the clean external location id.
  assert.equal(padded.trim(), locationId);
  assert.equal(nbspId.trim(), locationId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareLocationExternalId(padded), padded);
  assert.equal(canonicalizeSquareLocationExternalId(padded), null);
  assert.equal(canonicalizeSquareLocationExternalId(nbspId), null);
  assert.equal(normalizeSquareLocationExternalId(padded), null);
  assert.equal(normalizeSquareLocationExternalId(nbspId), null);

  // Soft empty still fails closed without inventing an external id from padding alone.
  assert.equal(normalizeSquareLocationExternalId(`${em}${em}`), null);
  assert.equal(normalizeSquareLocationExternalId(`${nbsp}`), null);
  assert.equal(normalizeSquareLocationExternalId("   "), null);

  // Live listSquareLocations must not invent a clean externalLocationId from
  // padded id; soft-null drops the location via the existing empty filter.
  const invented = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: padded,
          name: "Main Floor",
          timezone: "America/New_York"
        },
        {
          id: locationId,
          name: "Patio",
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.externalLocationId, locationId);
  assert.equal(invented[0]?.displayName, "Patio");

  const softEmpty = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: em,
          name: "Main Floor",
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(softEmpty.length, 0);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareLocationExternalId(internalEm), internalEm);
  assert.equal(normalizeSquareLocationExternalId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareLocationExternalId(internalEm), internalEm);

  const internalLocations = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: internalEm,
          name: "Main Floor",
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(internalLocations.length, 1);
  assert.equal(internalLocations[0]?.externalLocationId, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square location-list external ids", async () => {
  assert.equal(normalizeSquareLocationExternalId(undefined), null);
  assert.equal(normalizeSquareLocationExternalId(null), null);
  assert.equal(normalizeSquareLocationExternalId(""), null);
  assert.equal(normalizeSquareLocationExternalId("   "), null);
  assert.equal(normalizeSquareLocationExternalId(123 as unknown as string), null);
  assert.equal(normalizeSquareLocationExternalId(`\u0001${locationId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareLocationExternalId(`${locationId}\t`), locationId);
  assert.equal(normalizeSquareLocationExternalId(`${locationId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareLocationExternalId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareLocationExternalId("x".repeat(129)), null);
  assert.equal(normalizeSquareLocationExternalId("x".repeat(128)), "x".repeat(128));

  // Missing id still drops the location via the intentional empty filter.
  const missingId = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          name: "Main Floor",
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(missingId.length, 0);
});
