import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleLineUid,
  canonicalizeSquareOrderSaleLineUid,
  normalizeSquareOrderSaleLineUid
} from "../services/domain/squareOrderSaleLineUidIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleLineUidIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const lineUid = "line-1";
const accentedUid = "Café-Line-1";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005TD pins Square order-sale line uid to ASCII C", () => {
  assert.match(identitySource, /MISE-005TD/);
  assert.match(squareSource, /MISE-005TD/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleLineUid\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleLineUidIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOrderSaleLineUid\(/);

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleLineUid\(/);
  assert.doesNotMatch(normalizeBody, /stringField\(item,\s*"uid"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (order id, location_id, catalog_object_id, name).
  assert.match(normalizeBody, /stringField\(record,\s*"id"/);
  assert.match(normalizeBody, /stringField\(record,\s*"location_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"catalog_object_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square order-sale line uids stable", () => {
  assert.equal(asciiTrimSquareOrderSaleLineUid(`  ${lineUid}  `), lineUid);
  assert.equal(asciiTrimSquareOrderSaleLineUid(`\t${lineUid}\n`), lineUid);
  assert.equal(canonicalizeSquareOrderSaleLineUid(`  ${lineUid}  `), lineUid);
  assert.equal(normalizeSquareOrderSaleLineUid(`  ${lineUid}  `), lineUid);

  assert.equal(normalizeSquareOrderSaleLineUid(accentedUid), accentedUid);
  assert.equal(canonicalizeSquareOrderSaleLineUid(accentedUid), accentedUid);

  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: `  ${lineUid}  `,
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.source_record_id, `square_order-1_${lineUid}`);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale line uids", () => {
  const padded = `${em}${lineUid}${em}`;
  const nbspUid = `${nbsp}${lineUid}${nbsp}`;
  const internalEm = `line${em}1`;
  const internalNbsp = `line${nbsp}1`;

  // Inventing proof: Unicode trim would invent the clean line uid.
  assert.equal(padded.trim(), lineUid);
  assert.equal(nbspUid.trim(), lineUid);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleLineUid(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleLineUid(padded), null);
  assert.equal(canonicalizeSquareOrderSaleLineUid(nbspUid), null);
  assert.equal(normalizeSquareOrderSaleLineUid(padded), null);
  assert.equal(normalizeSquareOrderSaleLineUid(nbspUid), null);

  // Soft empty still fails closed without inventing a line uid from padding alone.
  assert.equal(normalizeSquareOrderSaleLineUid(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleLineUid(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleLineUid("   "), null);

  // Live normalizeOrderSales must not invent a clean source_record_id from padded uid;
  // soft-null falls through to the intentional String(index) fallback.
  const invented = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: padded,
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.source_record_id, "square_order-1_0");
  assert.notEqual(invented[0]?.source_record_id, `square_order-1_${lineUid}`);

  const softEmpty = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: em,
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.source_record_id, "square_order-1_0");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOrderSaleLineUid(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleLineUid(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleLineUid(internalEm), internalEm);

  const internalSales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: internalEm,
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(internalSales.length, 1);
  assert.equal(internalSales[0]?.source_record_id, `square_order-1_${internalEm}`);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale line uids", () => {
  assert.equal(normalizeSquareOrderSaleLineUid(undefined), null);
  assert.equal(normalizeSquareOrderSaleLineUid(null), null);
  assert.equal(normalizeSquareOrderSaleLineUid(""), null);
  assert.equal(normalizeSquareOrderSaleLineUid("   "), null);
  assert.equal(normalizeSquareOrderSaleLineUid(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleLineUid(`\u0001${lineUid}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleLineUid(`${lineUid}\t`), lineUid);
  assert.equal(normalizeSquareOrderSaleLineUid(`${lineUid}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleLineUid(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareOrderSaleLineUid("x".repeat(129)), null);
  assert.equal(normalizeSquareOrderSaleLineUid("x".repeat(128)), "x".repeat(128));

  // Missing uid still uses the intentional index fallback.
  const missingUid = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        name: "Burger",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(missingUid.length, 1);
  assert.equal(missingUid[0]?.source_record_id, "square_order-1_0");
});
