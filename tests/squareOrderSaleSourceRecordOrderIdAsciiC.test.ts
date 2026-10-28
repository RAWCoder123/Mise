import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleSourceRecordOrderId,
  canonicalizeSquareOrderSaleSourceRecordOrderId,
  normalizeSquareOrderSaleSourceRecordOrderId
} from "../services/domain/squareOrderSaleSourceRecordOrderIdIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleSourceRecordOrderIdIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const orderId = "order-1";
const accentedId = "Café-Order-1";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005TB pins Square order-sale source_record_id order id to ASCII C", () => {
  assert.match(identitySource, /MISE-005TB/);
  assert.match(squareSource, /MISE-005TB/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleSourceRecordOrderId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleSourceRecordOrderIdIdentity\.ts"/
  );
  assert.match(
    squareSource,
    /normalizeSquareOrderSaleSourceRecordOrderId\(/
  );

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleSourceRecordOrderId\(/);
  assert.doesNotMatch(
    normalizeBody,
    /stringField\(record,\s*"id"/
  );

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (location_id, catalog_object_id, item name, uid).
  assert.match(normalizeBody, /stringField\(record,\s*"location_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"catalog_object_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"name"/);
  assert.match(normalizeBody, /stringField\(item,\s*"uid"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square order-sale source-record order ids stable", () => {
  assert.equal(asciiTrimSquareOrderSaleSourceRecordOrderId(`  ${orderId}  `), orderId);
  assert.equal(asciiTrimSquareOrderSaleSourceRecordOrderId(`\t${orderId}\n`), orderId);
  assert.equal(canonicalizeSquareOrderSaleSourceRecordOrderId(`  ${orderId}  `), orderId);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(`  ${orderId}  `), orderId);

  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(accentedId), accentedId);
  assert.equal(canonicalizeSquareOrderSaleSourceRecordOrderId(accentedId), accentedId);

  const sales = normalizeOrderSales({
    id: `  ${orderId}  `,
    location_id: "loc-a",
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
  assert.equal(sales[0]?.source_record_id, `square_${orderId}_line-1`);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale source_record_id order ids", () => {
  const padded = `${em}${orderId}${em}`;
  const nbspId = `${nbsp}${orderId}${nbsp}`;
  const internalEm = `order${em}1`;
  const internalNbsp = `order${nbsp}1`;

  // Inventing proof: Unicode trim would invent the clean order id.
  assert.equal(padded.trim(), orderId);
  assert.equal(nbspId.trim(), orderId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleSourceRecordOrderId(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleSourceRecordOrderId(padded), null);
  assert.equal(canonicalizeSquareOrderSaleSourceRecordOrderId(nbspId), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(padded), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(nbspId), null);

  // Soft empty still fails closed without inventing an order id from padding alone.
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId("   "), null);

  // Live normalizeOrderSales must not invent a clean source_record_id from padded order id.
  const invented = normalizeOrderSales({
    id: padded,
    location_id: "loc-a",
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
  assert.equal(invented.length, 0);

  const softEmpty = normalizeOrderSales({
    id: em,
    location_id: "loc-a",
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
  assert.equal(softEmpty.length, 0);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOrderSaleSourceRecordOrderId(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(internalEm), internalEm);

  const internalSales = normalizeOrderSales({
    id: internalEm,
    location_id: "loc-a",
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
  assert.equal(internalSales.length, 1);
  assert.equal(internalSales[0]?.source_record_id, `square_${internalEm}_line-1`);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale source-record order ids", () => {
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(undefined), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(null), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(""), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId("   "), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(`\u0001${orderId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(`${orderId}\t`), orderId);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(`${orderId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId("x".repeat(129)), null);
  assert.equal(normalizeSquareOrderSaleSourceRecordOrderId("x".repeat(128)), "x".repeat(128));
});
