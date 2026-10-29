import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleVariationName,
  canonicalizeSquareOrderSaleVariationName,
  normalizeSquareOrderSaleVariationName
} from "../services/domain/squareOrderSaleVariationNameIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleVariationNameIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const variationName = "Large";
const accentedName = "Café Size";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005TL pins Square order-sale variation_name category to ASCII C", () => {
  assert.match(identitySource, /MISE-005TL/);
  assert.match(squareSource, /MISE-005TL/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleVariationName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleVariationNameIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOrderSaleVariationName\(/);

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleVariationName\(/);
  assert.doesNotMatch(normalizeBody, /stringField\(item,\s*"variation_name"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (order id, location_id, catalog_object_id,
  // uid, name, closed_at/created_at).
  assert.match(normalizeBody, /stringField\(record,\s*"id"/);
  assert.match(normalizeBody, /stringField\(record,\s*"location_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"catalog_object_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"uid"/);
  assert.match(normalizeBody, /stringField\(item,\s*"name"/);
  assert.match(normalizeBody, /stringField\(record,\s*"closed_at"/);
  assert.match(normalizeBody, /stringField\(record,\s*"created_at"/);

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

test("ASCII C prep keeps ordinary Square order-sale variation names stable", () => {
  assert.equal(asciiTrimSquareOrderSaleVariationName(`  ${variationName}  `), variationName);
  assert.equal(asciiTrimSquareOrderSaleVariationName(`\t${variationName}\n`), variationName);
  assert.equal(canonicalizeSquareOrderSaleVariationName(`  ${variationName}  `), variationName);
  assert.equal(normalizeSquareOrderSaleVariationName(`  ${variationName}  `), variationName);

  assert.equal(normalizeSquareOrderSaleVariationName(accentedName), accentedName);
  assert.equal(canonicalizeSquareOrderSaleVariationName(accentedName), accentedName);

  // Category-fallback path: no catalog_object_id → variation_name becomes category.
  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        variation_name: `  ${variationName}  `,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.category, variationName);
  assert.equal(sales[0]?.provider_variation_id, undefined);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale categories", () => {
  const padded = `${em}${variationName}${em}`;
  const nbspName = `${nbsp}${variationName}${nbsp}`;
  const internalEm = `Lar${em}ge`;
  const internalNbsp = `Lar${nbsp}ge`;

  // Inventing proof: Unicode trim would invent the clean variation name.
  assert.equal(padded.trim(), variationName);
  assert.equal(nbspName.trim(), variationName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleVariationName(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleVariationName(padded), null);
  assert.equal(canonicalizeSquareOrderSaleVariationName(nbspName), null);
  assert.equal(normalizeSquareOrderSaleVariationName(padded), null);
  assert.equal(normalizeSquareOrderSaleVariationName(nbspName), null);

  // Soft empty still fails closed without inventing a clean category from padding alone.
  assert.equal(normalizeSquareOrderSaleVariationName(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleVariationName(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleVariationName("   "), null);

  // Live normalizeOrderSales must not invent a clean category from padded variation_name.
  // Fail closed through the existing Square fallback instead of inventing Large.
  const invented = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        variation_name: padded,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.category, "Square");
  assert.notEqual(invented[0]?.category, variationName);

  const softEmpty = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        variation_name: em,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.category, "Square");

  // When catalog_object_id is present, category prefers that identity and
  // variation_name is not consulted — leave that sibling tip alone.
  const withVariationId = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        catalog_object_id: "var-1",
        variation_name: padded,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(withVariationId.length, 1);
  assert.equal(withVariationId[0]?.category, "var-1");
  assert.equal(withVariationId[0]?.provider_variation_id, "var-1");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOrderSaleVariationName(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleVariationName(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleVariationName(internalEm), internalEm);

  const internalSales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: "Burger",
        variation_name: internalEm,
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(internalSales.length, 1);
  assert.equal(internalSales[0]?.category, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale variation names", () => {
  assert.equal(normalizeSquareOrderSaleVariationName(undefined), null);
  assert.equal(normalizeSquareOrderSaleVariationName(null), null);
  assert.equal(normalizeSquareOrderSaleVariationName(""), null);
  assert.equal(normalizeSquareOrderSaleVariationName("   "), null);
  assert.equal(normalizeSquareOrderSaleVariationName(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleVariationName(`\u0001${variationName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleVariationName(`${variationName}\t`), variationName);
  assert.equal(normalizeSquareOrderSaleVariationName(`${variationName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleVariationName(em), null);
  // Overlong tokens fail closed (prior stringField max 80).
  assert.equal(normalizeSquareOrderSaleVariationName("x".repeat(81)), null);
  assert.equal(normalizeSquareOrderSaleVariationName("x".repeat(80)), "x".repeat(80));

  const missingVariationName = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
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
  assert.equal(missingVariationName.length, 1);
  assert.equal(missingVariationName[0]?.category, "Square");
});
