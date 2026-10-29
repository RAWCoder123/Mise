import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareLocationDisplayName,
  canonicalizeSquareLocationDisplayName,
  normalizeSquareLocationDisplayName
} from "../services/domain/squareLocationDisplayNameIdentity";
import { listSquareLocations } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareLocationDisplayNameIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const displayName = "Main Floor";
const accentedName = "Café Patio";
const em = "\u2003";
const nbsp = "\u00a0";

function locationsFetch(payload: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
}

test("MISE-005TK pins Square location-list displayName to ASCII C", () => {
  assert.match(identitySource, /MISE-005TK/);
  assert.match(squareSource, /MISE-005TK/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareLocationDisplayName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareLocationDisplayNameIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareLocationDisplayName\(/);

  const listStart = squareSource.indexOf("export async function listSquareLocations(");
  const listEnd = squareSource.indexOf("export async function searchSquareOrders(");
  assert.ok(listStart > 0 && listEnd > listStart);
  const listBody = squareSource.slice(listStart, listEnd);
  assert.match(listBody, /normalizeSquareLocationDisplayName\(/);
  assert.doesNotMatch(listBody, /stringField\(record,\s*"name"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (external location id). Leave timezone raw
  // length gate alone.
  assert.match(listBody, /stringField\(record,\s*"id"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square location-list display names stable", async () => {
  assert.equal(asciiTrimSquareLocationDisplayName(`  ${displayName}  `), displayName);
  assert.equal(asciiTrimSquareLocationDisplayName(`\t${displayName}\n`), displayName);
  assert.equal(canonicalizeSquareLocationDisplayName(`  ${displayName}  `), displayName);
  assert.equal(normalizeSquareLocationDisplayName(`  ${displayName}  `), displayName);

  assert.equal(normalizeSquareLocationDisplayName(accentedName), accentedName);
  assert.equal(canonicalizeSquareLocationDisplayName(accentedName), accentedName);

  const locations = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: "LOC_ABC123",
          name: `  ${displayName}  `,
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(locations.length, 1);
  assert.equal(locations[0]?.externalLocationId, "LOC_ABC123");
  assert.equal(locations[0]?.displayName, displayName);
});

test("Unicode em-space / NBSP padding cannot invent clean Square location-list display names", async () => {
  const padded = `${em}${displayName}${em}`;
  const nbspName = `${nbsp}${displayName}${nbsp}`;
  const internalEm = `Main${em}Floor`;
  const internalNbsp = `Main${nbsp}Floor`;

  // Inventing proof: Unicode trim would invent the clean location display name.
  assert.equal(padded.trim(), displayName);
  assert.equal(nbspName.trim(), displayName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareLocationDisplayName(padded), padded);
  assert.equal(canonicalizeSquareLocationDisplayName(padded), null);
  assert.equal(canonicalizeSquareLocationDisplayName(nbspName), null);
  assert.equal(normalizeSquareLocationDisplayName(padded), null);
  assert.equal(normalizeSquareLocationDisplayName(nbspName), null);

  // Soft empty still fails closed without inventing a display name from padding alone.
  assert.equal(normalizeSquareLocationDisplayName(`${em}${em}`), null);
  assert.equal(normalizeSquareLocationDisplayName(`${nbsp}`), null);
  assert.equal(normalizeSquareLocationDisplayName("   "), null);

  // Live listSquareLocations must not invent a clean displayName from padded
  // name; soft-null collapses to the intentional "Square location" fallback
  // instead of inventing the clean operator-facing label.
  const invented = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: "LOC_PADDED",
          name: padded,
          timezone: "America/New_York"
        },
        {
          id: "LOC_CLEAN",
          name: displayName,
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(invented.length, 2);
  assert.equal(invented[0]?.externalLocationId, "LOC_PADDED");
  assert.equal(invented[0]?.displayName, "Square location");
  assert.notEqual(invented[0]?.displayName, displayName);
  assert.equal(invented[1]?.externalLocationId, "LOC_CLEAN");
  assert.equal(invented[1]?.displayName, displayName);

  const inventedNbsp = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: "LOC_NBSP",
          name: nbspName,
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(inventedNbsp.length, 1);
  assert.equal(inventedNbsp[0]?.displayName, "Square location");

  const softEmpty = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: "LOC_EMPTY",
          name: em,
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.displayName, "Square location");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareLocationDisplayName(internalEm), internalEm);
  assert.equal(normalizeSquareLocationDisplayName(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareLocationDisplayName(internalEm), internalEm);

  const internalLocations = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: "LOC_INTERNAL",
          name: internalEm,
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(internalLocations.length, 1);
  assert.equal(internalLocations[0]?.displayName, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square location-list display names", async () => {
  assert.equal(normalizeSquareLocationDisplayName(undefined), null);
  assert.equal(normalizeSquareLocationDisplayName(null), null);
  assert.equal(normalizeSquareLocationDisplayName(""), null);
  assert.equal(normalizeSquareLocationDisplayName("   "), null);
  assert.equal(normalizeSquareLocationDisplayName(123 as unknown as string), null);
  assert.equal(normalizeSquareLocationDisplayName(`\u0001${displayName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareLocationDisplayName(`${displayName}\t`), displayName);
  assert.equal(normalizeSquareLocationDisplayName(`${displayName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareLocationDisplayName(em), null);
  // Overlong tokens fail closed (prior stringField max 200).
  assert.equal(normalizeSquareLocationDisplayName("x".repeat(201)), null);
  assert.equal(normalizeSquareLocationDisplayName("x".repeat(200)), "x".repeat(200));

  // Missing name still uses the intentional "Square location" fallback.
  const missingName = await listSquareLocations(
    { environment: "sandbox" },
    "square-access-token",
    locationsFetch({
      locations: [
        {
          id: "LOC_MISSING_NAME",
          timezone: "America/New_York"
        }
      ]
    })
  );
  assert.equal(missingName.length, 1);
  assert.equal(missingName[0]?.displayName, "Square location");
});
