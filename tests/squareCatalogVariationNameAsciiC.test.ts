import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareCatalogVariationName,
  canonicalizeSquareCatalogVariationName,
  normalizeSquareCatalogVariationName
} from "../services/domain/squareCatalogVariationNameIdentity";
import { normalizeCatalogItem } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareCatalogVariationNameIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const itemName = "Burger";
const variationName = "Large";
const accentedName = "Café Large";
const em = "\u2003";
const nbsp = "\u00a0";

function catalogItem(name: unknown, variations: unknown[]) {
  return {
    type: "ITEM",
    id: "item-1",
    item_data: {
      name,
      product_type: "REGULAR",
      variations
    }
  };
}

test("MISE-005TJ pins Square catalog variation name to ASCII C", () => {
  assert.match(identitySource, /MISE-005TJ/);
  assert.match(squareSource, /MISE-005TJ/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareCatalogVariationName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareCatalogVariationNameIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareCatalogVariationName\(/);

  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  const catalogEnd = squareSource.indexOf("function squareHeaders(");
  assert.ok(catalogStart > 0 && catalogEnd > catalogStart);
  const catalogBody = squareSource.slice(catalogStart, catalogEnd);
  assert.match(catalogBody, /normalizeSquareCatalogVariationName\(/);
  assert.doesNotMatch(catalogBody, /stringField\(variationData,\s*"name"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (catalog item id, item name, variation id).
  assert.match(catalogBody, /stringField\(record,\s*"id"/);
  assert.match(catalogBody, /stringField\(itemData,\s*"name"/);
  assert.match(catalogBody, /stringField\(row,\s*"id"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogVariationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square catalog variation names stable", () => {
  assert.equal(asciiTrimSquareCatalogVariationName(`  ${variationName}  `), variationName);
  assert.equal(asciiTrimSquareCatalogVariationName(`\t${variationName}\n`), variationName);
  assert.equal(canonicalizeSquareCatalogVariationName(`  ${variationName}  `), variationName);
  assert.equal(normalizeSquareCatalogVariationName(`  ${variationName}  `), variationName);

  assert.equal(normalizeSquareCatalogVariationName(accentedName), accentedName);
  assert.equal(canonicalizeSquareCatalogVariationName(accentedName), accentedName);

  const regular = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(regular.length, 1);
  assert.equal(regular[0]?.external_catalog_item_id, "item-1");
  assert.equal(regular[0]?.external_variation_id, "var-1");
  assert.equal(regular[0]?.external_name, itemName);

  const composed = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-2",
        item_variation_data: { name: `  ${variationName}  ` }
      }
    ])
  );
  assert.equal(composed.length, 1);
  assert.equal(composed[0]?.external_name, `${itemName} — ${variationName}`);

  const asciiPaddedRegular = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-3",
        item_variation_data: { name: "  Regular  " }
      }
    ])
  );
  assert.equal(asciiPaddedRegular.length, 1);
  assert.equal(asciiPaddedRegular[0]?.external_name, itemName);
});

test("Unicode em-space / NBSP padding cannot invent clean Square catalog variation names", () => {
  const padded = `${em}${variationName}${em}`;
  const nbspName = `${nbsp}${variationName}${nbsp}`;
  const internalEm = `Extra${em}Large`;
  const internalNbsp = `Extra${nbsp}Large`;
  const paddedRegular = `${em}Regular${em}`;

  // Inventing proof: Unicode trim would invent the clean catalog variation name.
  assert.equal(padded.trim(), variationName);
  assert.equal(nbspName.trim(), variationName);
  assert.equal(paddedRegular.trim(), "Regular");

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareCatalogVariationName(padded), padded);
  assert.equal(canonicalizeSquareCatalogVariationName(padded), null);
  assert.equal(canonicalizeSquareCatalogVariationName(nbspName), null);
  assert.equal(normalizeSquareCatalogVariationName(padded), null);
  assert.equal(normalizeSquareCatalogVariationName(nbspName), null);
  assert.equal(normalizeSquareCatalogVariationName(paddedRegular), null);

  // Soft empty still fails closed without inventing a variation name from padding alone.
  assert.equal(normalizeSquareCatalogVariationName(`${em}${em}`), null);
  assert.equal(normalizeSquareCatalogVariationName(`${nbsp}`), null);
  assert.equal(normalizeSquareCatalogVariationName("   "), null);

  // Live normalizeCatalogItem must not invent a clean variation label inside
  // composed external_name; soft-null keeps the item-name-only composition
  // instead of inventing `${itemName} — Large` from padding.
  const invented = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-1",
        item_variation_data: { name: padded }
      }
    ])
  );
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.external_name, itemName);
  assert.equal(invented[0]?.external_catalog_item_id, "item-1");
  assert.notEqual(invented[0]?.external_name, `${itemName} — ${variationName}`);

  const inventedNbsp = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-2",
        item_variation_data: { name: nbspName }
      }
    ])
  );
  assert.equal(inventedNbsp.length, 1);
  assert.equal(inventedNbsp[0]?.external_name, itemName);

  // Padded "Regular" also fails closed to the item-name-only path (same
  // operator-facing outcome as a true Regular variation, without inventing
  // a clean Regular token via Unicode trim).
  const inventedRegular = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-3",
        item_variation_data: { name: paddedRegular }
      }
    ])
  );
  assert.equal(inventedRegular.length, 1);
  assert.equal(inventedRegular[0]?.external_name, itemName);

  const softEmpty = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-4",
        item_variation_data: { name: em }
      }
    ])
  );
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.external_name, itemName);

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareCatalogVariationName(internalEm), internalEm);
  assert.equal(normalizeSquareCatalogVariationName(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareCatalogVariationName(internalEm), internalEm);

  const internalCatalog = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-5",
        item_variation_data: { name: internalEm }
      }
    ])
  );
  assert.equal(internalCatalog.length, 1);
  assert.equal(internalCatalog[0]?.external_name, `${itemName} — ${internalEm}`);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square catalog variation names", () => {
  assert.equal(normalizeSquareCatalogVariationName(undefined), null);
  assert.equal(normalizeSquareCatalogVariationName(null), null);
  assert.equal(normalizeSquareCatalogVariationName(""), null);
  assert.equal(normalizeSquareCatalogVariationName("   "), null);
  assert.equal(normalizeSquareCatalogVariationName(123 as unknown as string), null);
  assert.equal(normalizeSquareCatalogVariationName(`\u0001${variationName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareCatalogVariationName(`${variationName}\t`), variationName);
  assert.equal(normalizeSquareCatalogVariationName(`${variationName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareCatalogVariationName(em), null);
  // Overlong tokens fail closed (prior stringField max 160).
  assert.equal(normalizeSquareCatalogVariationName("x".repeat(161)), null);
  assert.equal(normalizeSquareCatalogVariationName("x".repeat(160)), "x".repeat(160));

  // Missing variation name still collapses to the item-name-only composition.
  const missingName = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-1",
        item_variation_data: { name: undefined }
      }
    ])
  );
  assert.equal(missingName.length, 1);
  assert.equal(missingName[0]?.external_name, itemName);

  const missingVariationData = normalizeCatalogItem(
    catalogItem(itemName, [
      {
        id: "var-2"
      }
    ])
  );
  assert.equal(missingVariationData.length, 1);
  assert.equal(missingVariationData[0]?.external_name, itemName);
});
