import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareOrderSaleItemName,
  canonicalizeSquareOrderSaleItemName,
  normalizeSquareOrderSaleItemName
} from "../services/domain/squareOrderSaleItemNameIdentity";
import { normalizeOrderSales } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareOrderSaleItemNameIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const itemName = "Burger";
const accentedName = "Café Bowl";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005TC pins Square order-sale item_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005TC/);
  assert.match(squareSource, /MISE-005TC/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareOrderSaleItemName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareOrderSaleItemNameIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareOrderSaleItemName\(/);

  const normalizeStart = squareSource.indexOf("export function normalizeOrderSales(");
  const normalizeEnd = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(normalizeStart > 0 && normalizeEnd > normalizeStart);
  const normalizeBody = squareSource.slice(normalizeStart, normalizeEnd);
  assert.match(normalizeBody, /normalizeSquareOrderSaleItemName\(/);
  assert.doesNotMatch(normalizeBody, /stringField\(item,\s*"name"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (order id, location_id, catalog_object_id, uid).
  assert.match(normalizeBody, /stringField\(record,\s*"id"/);
  assert.match(normalizeBody, /stringField\(record,\s*"location_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"catalog_object_id"/);
  assert.match(normalizeBody, /stringField\(item,\s*"uid"/);

  // Leave catalog normalize item/variation names alone for separate tips.
  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  assert.ok(catalogStart > 0);
  const catalogBody = squareSource.slice(catalogStart);
  assert.match(catalogBody, /stringField\(itemData,\s*"name"/);
  assert.match(catalogBody, /stringField\(variationData,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square order-sale item names stable", () => {
  assert.equal(asciiTrimSquareOrderSaleItemName(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimSquareOrderSaleItemName(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeSquareOrderSaleItemName(`  ${itemName}  `), itemName);
  assert.equal(normalizeSquareOrderSaleItemName(`  ${itemName}  `), itemName);

  assert.equal(normalizeSquareOrderSaleItemName(accentedName), accentedName);
  assert.equal(canonicalizeSquareOrderSaleItemName(accentedName), accentedName);

  const sales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: `  ${itemName}  `,
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(sales.length, 1);
  assert.equal(sales[0]?.item_name, itemName);
});

test("Unicode em-space / NBSP padding cannot invent clean Square order-sale item names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Bur${em}ger`;
  const internalNbsp = `Bur${nbsp}ger`;

  // Inventing proof: Unicode trim would invent the clean item name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareOrderSaleItemName(padded), padded);
  assert.equal(canonicalizeSquareOrderSaleItemName(padded), null);
  assert.equal(canonicalizeSquareOrderSaleItemName(nbspName), null);
  assert.equal(normalizeSquareOrderSaleItemName(padded), null);
  assert.equal(normalizeSquareOrderSaleItemName(nbspName), null);

  // Soft empty still fails closed without inventing a clean item name from padding alone.
  assert.equal(normalizeSquareOrderSaleItemName(`${em}${em}`), null);
  assert.equal(normalizeSquareOrderSaleItemName(`${nbsp}`), null);
  assert.equal(normalizeSquareOrderSaleItemName("   "), null);

  // Live normalizeOrderSales must not invent a clean item_name from padded name.
  // Fail closed through the existing Untitled fallback instead of inventing Burger.
  const invented = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: padded,
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.item_name, "Untitled item");
  assert.notEqual(invented[0]?.item_name, itemName);

  const softEmpty = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: em,
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.item_name, "Untitled item");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareOrderSaleItemName(internalEm), internalEm);
  assert.equal(normalizeSquareOrderSaleItemName(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareOrderSaleItemName(internalEm), internalEm);

  const internalSales = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        name: internalEm,
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(internalSales.length, 1);
  assert.equal(internalSales[0]?.item_name, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square order-sale item names", () => {
  assert.equal(normalizeSquareOrderSaleItemName(undefined), null);
  assert.equal(normalizeSquareOrderSaleItemName(null), null);
  assert.equal(normalizeSquareOrderSaleItemName(""), null);
  assert.equal(normalizeSquareOrderSaleItemName("   "), null);
  assert.equal(normalizeSquareOrderSaleItemName(123 as unknown as string), null);
  assert.equal(normalizeSquareOrderSaleItemName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareOrderSaleItemName(`${itemName}\t`), itemName);
  assert.equal(normalizeSquareOrderSaleItemName(`${itemName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareOrderSaleItemName(em), null);
  // Overlong tokens fail closed (prior stringField max 160).
  assert.equal(normalizeSquareOrderSaleItemName("x".repeat(161)), null);
  assert.equal(normalizeSquareOrderSaleItemName("x".repeat(160)), "x".repeat(160));

  const missingName = normalizeOrderSales({
    id: "order-1",
    location_id: "loc-a",
    closed_at: "2026-07-30T12:00:00.000Z",
    line_items: [
      {
        uid: "line-1",
        catalog_object_id: "var-1",
        quantity: "1",
        gross_sales_money: { amount: 1200, currency: "USD" },
        total_money: { amount: 1200, currency: "USD" }
      }
    ]
  });
  assert.equal(missingName.length, 1);
  assert.equal(missingName[0]?.item_name, "Untitled item");
});
