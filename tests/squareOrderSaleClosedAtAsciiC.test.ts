import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleClosedAt,
  canonicalizeSquareOrderSaleClosedAt,
  normalizeSquareOrderSaleClosedAt
} from "../services/domain/squareOrderSaleClosedAtIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleClosedAtIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const closedAt = "2026-07-30T12:00:00.000Z";
const saleDate = "2026-07-30";
const createdAt = "2026-07-29T09:15:00.000Z";
const createdSaleDate = "2026-07-29";
const em = "\u2003";
const nbsp = "\u00a0";

function lineItem() {
  return {
    uid: "line-1",
    name: "Burger",
    quantity: "1",
    gross_sales_money: { amount: 1200, currency: "USD" },
    total_money: { amount: 1200, currency: "USD" }
  };
}

test("MISE-005TM pins Square order-sale closed_at / created_at sale_date to ASCII C", () => {
  assert.match(identitySource, /MISE-005TM/);
  assert.match(squareSource, /MISE-005TM/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleClosedAt\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleClosedAtIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOrderSaleClosedAt\(/);

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleClosedAt\(/);
  assert.doesNotMatch(normalizeBody, /stringField\(record,\s*"closed_at"/);
  assert.doesNotMatch(normalizeBody, /stringField\(record,\s*"created_at"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (order id, location_id, catalog_object_id,
  // uid, name, variation_name).
  assert.match(normalizeBody, /stringField\(record,\s*"id"/);
  assert.match(normalizeBody, /stringField\(record,\s*"location_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"catalog_object_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"uid"/);
  assert.match(normalizeBody, /stringField\(item,\s*"name"/);
  assert.match(normalizeBody, /stringField\(item,\s*"variation_name"/);

  // Leave catalog normalize product_type / category_id / names alone.
  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(catalogStart > 0);
  const catalogBody = squareSource.slice(catalogStart);
  assert.match(catalogBody, /stringField\(itemData,\s*"product_type"/);
  assert.match(catalogBody, /stringField\(itemData,\s*"category_id"/);
  assert.match(catalogBody, /stringField\(itemData,\s*"name"/);
  assert.match(catalogBody, /stringField\(variationData,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square order-sale closed_at timestamps stable", () => {
  assert.equal(asciiTrimSquareOrderSaleClosedAt(`  ${closedAt}  `), closedAt);
  assert.equal(asciiTrimSquareOrderSaleClosedAt(`\t${closedAt}\n`), closedAt);
  assert.equal(canonicalizeSquareOrderSaleClosedAt(`  ${closedAt}  `), closedAt);
  assert.equal(normalizeSquareOrderSaleClosedAt(`  ${closedAt}  `), closedAt);

  // Primary closed_at path → durable sale_date.
  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: `  ${closedAt}  `,
    line_items: [lineItem()]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.sale_date, saleDate);

  // created_at fallback when closed_at is absent.
  const fromCreated = normalizeOrderSales({
    id: "order-2",
    location_id: "loc-a",
    created_at: `  ${createdAt}  `,
    line_items: [lineItem()]
  });
  assert.equal(fromCreated.length, 1);
  assert.equal(fromCreated[0]?.sale_date, createdSaleDate);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale sale_date", () => {
  const padded = `${em}${closedAt}${em}`;
  const nbspTs = `${nbsp}${closedAt}${nbsp}`;
  const paddedCreated = `${em}${createdAt}${em}`;

  // Inventing proof: Unicode trim would invent the clean timestamp / sale_date.
  assert.equal(padded.trim(), closedAt);
  assert.equal(nbspTs.trim(), closedAt);
  assert.equal(padded.trim().slice(0, 10), saleDate);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleClosedAt(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleClosedAt(padded), null);
  assert.equal(canonicalizeSquareOrderSaleClosedAt(nbspTs), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(padded), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(nbspTs), null);

  // Soft empty still fails closed without inventing a clean sale_date from padding alone.
  assert.equal(normalizeSquareOrderSaleClosedAt(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleClosedAt("   "), null);

  // Live normalizeOrderSales must not invent a clean sale_date from padded closed_at.
  // Fail closed through the existing new Date().toISOString() fallback instead of
  // inventing 2026-07-30.
  const invented = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: padded,
    line_items: [lineItem()]
  });
  assert.equal(invented.length, 1);
  assert.notEqual(invented[0]?.sale_date, saleDate);
  assert.equal(invented[0]?.sale_date, new Date().toISOString().slice(0, 10));

  const softEmpty = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: em,
    line_items: [lineItem()]
  });
  assert.equal(softEmpty.length, 1);
  assert.notEqual(softEmpty[0]?.sale_date, saleDate);
  assert.equal(softEmpty[0]?.sale_date, new Date().toISOString().slice(0, 10));

  // Padded closed_at must not invent; clean created_at still owns the fallback.
  const closedPaddedCreatedClean = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: padded,
    created_at: createdAt,
    line_items: [lineItem()]
  });
  assert.equal(closedPaddedCreatedClean.length, 1);
  assert.equal(closedPaddedCreatedClean[0]?.sale_date, createdSaleDate);
  assert.notEqual(closedPaddedCreatedClean[0]?.sale_date, saleDate);

  // Both padded → fail closed to today without inventing either padded date.
  const bothPadded = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: padded,
    created_at: paddedCreated,
    line_items: [lineItem()]
  });
  assert.equal(bothPadded.length, 1);
  assert.notEqual(bothPadded[0]?.sale_date, saleDate);
  assert.notEqual(bothPadded[0]?.sale_date, createdSaleDate);
  assert.equal(bothPadded[0]?.sale_date, new Date().toISOString().slice(0, 10));

  // Internal Unicode padding is preserved (not end-trimmed away), matching
  // sibling Square order-sale ASCII C tips. sale_date still derives from the
  // leading YYYY-MM-DD prefix that was already present — this is not the
  // end-padding inventing path under test.
  const internalEm = `2026-07-30T12${em}:00:00.000Z`;
  const internalNbsp = `2026-07-30T12${nbsp}:00:00.000Z`;
  assert.equal(canonicalizeSquareOrderSaleClosedAt(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleClosedAt(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleClosedAt(internalEm), internalEm);

  const internal = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: internalEm,
    line_items: [lineItem()]
  });
  assert.equal(internal.length, 1);
  assert.equal(internal[0]?.sale_date, saleDate);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale closed_at", () => {
  assert.equal(normalizeSquareOrderSaleClosedAt(undefined), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(null), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(""), null);
  assert.equal(normalizeSquareOrderSaleClosedAt("   "), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleClosedAt(`\u0001${closedAt}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleClosedAt(`${closedAt}\t`), closedAt);
  assert.equal(normalizeSquareOrderSaleClosedAt(`${closedAt}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleClosedAt(em), null);
  // Overlong tokens fail closed (prior stringField max 64).
  assert.equal(normalizeSquareOrderSaleClosedAt("x".repeat(65)), null);
  assert.equal(normalizeSquareOrderSaleClosedAt("x".repeat(64)), "x".repeat(64));

  const missingTimestamps = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    line_items: [lineItem()]
  });
  assert.equal(missingTimestamps.length, 1);
  assert.equal(missingTimestamps[0]?.sale_date, new Date().toISOString().slice(0, 10));
  assert.notEqual(missingTimestamps[0]?.sale_date, saleDate);
});

test("MISE-005TM leaves sibling Square order-sale stringField identities alone", () => {
  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: closedAt,
    line_items: [
      {
        ...lineItem(),
        catalog_object_id: "var-1",
        variation_name: "Large",
        name: "Burger"
      }
    ]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.sale_date, saleDate);
  assert.equal(sales[0]?.item_name, "Burger");
  assert.equal(sales[0]?.category, "var-1");
  assert.equal(sales[0]?.provider_variation_id, "var-1");
  assert.equal(sales[0]?.provider_location_id, "loc-a");
  assert.equal(sales[0]?.source_record_id, "square_order-1_line-1");
});
