import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleProviderLocationId,
  canonicalizeSquareOrderSaleProviderLocationId,
  normalizeSquareOrderSaleProviderLocationId
} from "../services/domain/squareOrderSaleProviderLocationIdIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleProviderLocationIdIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const locationId = "loc-a";
const accentedId = "Café-Loc-1";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SZ pins Square order-sale provider_location_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005SZ/);
  assert.match(squareSource, /MISE-005SZ/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleProviderLocationId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleProviderLocationIdIdentity\.ts"/
  );
  assert.match(
    squareSource,
    /normalizeSquareOrderSaleProviderLocationId\(/
  );

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleProviderLocationId\(/);
  assert.doesNotMatch(
    normalizeBody,
    /stringField\(record,\s*"location_id"/
  );

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (order id, catalog_object_id, item name, etc.).
  assert.match(normalizeBody, /stringField\(record,\s*"id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"catalog_object_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square order-sale provider location ids stable", () => {
  assert.equal(asciiTrimSquareOrderSaleProviderLocationId(`  ${locationId}  `), locationId);
  assert.equal(asciiTrimSquareOrderSaleProviderLocationId(`\t${locationId}\n`), locationId);
  assert.equal(canonicalizeSquareOrderSaleProviderLocationId(`  ${locationId}  `), locationId);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(`  ${locationId}  `), locationId);

  assert.equal(normalizeSquareOrderSaleProviderLocationId(accentedId), accentedId);
  assert.equal(canonicalizeSquareOrderSaleProviderLocationId(accentedId), accentedId);

  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: `  ${locationId}  `,
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.provider_location_id, locationId);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale provider location ids", () => {
  const padded = `${em}${locationId}${em}`;
  const nbspId = `${nbsp}${locationId}${nbsp}`;
  const internalEm = `loc${em}a`;
  const internalNbsp = `loc${nbsp}a`;

  // Inventing proof: Unicode trim would invent the clean location id.
  assert.equal(padded.trim(), locationId);
  assert.equal(nbspId.trim(), locationId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleProviderLocationId(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleProviderLocationId(padded), null);
  assert.equal(canonicalizeSquareOrderSaleProviderLocationId(nbspId), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(padded), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(nbspId), null);

  // Soft empty still fails closed without inventing a location id from padding alone.
  assert.equal(normalizeSquareOrderSaleProviderLocationId(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId("   "), null);

  // Live normalizeOrderSales must not invent a clean provider_location_id.
  const invented = normalizeOrderSales({
    id: "order-padded",
    location_id: padded,
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.provider_location_id, undefined);

  const softEmpty = normalizeOrderSales({
    id: "order-empty-location",
    location_id: em,
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.provider_location_id, undefined);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOrderSaleProviderLocationId(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(internalEm), internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale provider location ids", () => {
  assert.equal(normalizeSquareOrderSaleProviderLocationId(undefined), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(null), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(""), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId("   "), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(`\u0001${locationId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleProviderLocationId(`${locationId}\t`), locationId);
  assert.equal(normalizeSquareOrderSaleProviderLocationId(`${locationId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleProviderLocationId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareOrderSaleProviderLocationId("x".repeat(129)), null);
  assert.equal(normalizeSquareOrderSaleProviderLocationId("x".repeat(128)), "x".repeat(128));
});
