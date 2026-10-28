import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleProviderVariationId,
  canonicalizeSquareOrderSaleProviderVariationId,
  normalizeSquareOrderSaleProviderVariationId
} from "../services/domain/squareOrderSaleProviderVariationIdIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleProviderVariationIdIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const variationId = "var-1";
const accentedId = "Café-Var-1";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005TA pins Square order-sale provider_variation_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005TA/);
  assert.match(squareSource, /MISE-005TA/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleProviderVariationId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleProviderVariationIdIdentity\.ts"/
  );
  assert.match(
    squareSource,
    /normalizeSquareOrderSaleProviderVariationId\(/
  );

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleProviderVariationId\(/);
  assert.doesNotMatch(
    normalizeBody,
    /stringField\(item,\s*"catalog_object_id"/
  );

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (order id, location_id, item name, etc.).
  assert.match(normalizeBody, /stringField\(record,\s*"id"/);
  assert.match(normalizeBody, /stringField\(record,\s*"location_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square order-sale provider variation ids stable", () => {
  assert.equal(asciiTrimSquareOrderSaleProviderVariationId(`  ${variationId}  `), variationId);
  assert.equal(asciiTrimSquareOrderSaleProviderVariationId(`\t${variationId}\n`), variationId);
  assert.equal(canonicalizeSquareOrderSaleProviderVariationId(`  ${variationId}  `), variationId);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(`  ${variationId}  `), variationId);

  assert.equal(normalizeSquareOrderSaleProviderVariationId(accentedId), accentedId);
  assert.equal(canonicalizeSquareOrderSaleProviderVariationId(accentedId), accentedId);

  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: `  ${variationId}  `,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.provider_variation_id, variationId);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale provider variation ids", () => {
  const padded = `${em}${variationId}${em}`;
  const nbspId = `${nbsp}${variationId}${nbsp}`;
  const internalEm = `var${em}1`;
  const internalNbsp = `var${nbsp}1`;

  // Inventing proof: Unicode trim would invent the clean variation id.
  assert.equal(padded.trim(), variationId);
  assert.equal(nbspId.trim(), variationId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleProviderVariationId(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleProviderVariationId(padded), null);
  assert.equal(canonicalizeSquareOrderSaleProviderVariationId(nbspId), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(padded), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(nbspId), null);

  // Soft empty still fails closed without inventing a variation id from padding alone.
  assert.equal(normalizeSquareOrderSaleProviderVariationId(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId("   "), null);

  // Live normalizeOrderSales must not invent a clean provider_variation_id.
  const invented = normalizeOrderSales({
    id: "order-padded",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: padded,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.provider_variation_id, undefined);

  const softEmpty = normalizeOrderSales({
    id: "order-empty-variation",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: em,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.provider_variation_id, undefined);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOrderSaleProviderVariationId(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(internalEm), internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale provider variation ids", () => {
  assert.equal(normalizeSquareOrderSaleProviderVariationId(undefined), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(null), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(""), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId("   "), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(`\u0001${variationId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleProviderVariationId(`${variationId}\t`), variationId);
  assert.equal(normalizeSquareOrderSaleProviderVariationId(`${variationId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleProviderVariationId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareOrderSaleProviderVariationId("x".repeat(129)), null);
  assert.equal(normalizeSquareOrderSaleProviderVariationId("x".repeat(128)), "x".repeat(128));
});
