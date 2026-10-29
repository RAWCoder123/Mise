import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareCatalogVariationExternalId,
  canonicalizeSquareCatalogVariationExternalId,
  normalizeSquareCatalogVariationExternalId
} from "../services/domain/squareCatalogVariationExternalIdIdentity";
import { normalizeCatalogItem } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareCatalogVariationExternalIdIdentity.ts", import.meta.url),
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

function catalogItem(variations: unknown[]) {
  return {
    type: "ITEM",
    id: "item-1",
    item_data: {
      name: "Burger",
      product_type: "REGULAR",
      variations
    }
  };
}

test("MISE-005TG pins Square catalog variation external_variation_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005TG/);
  assert.match(squareSource, /MISE-005TG/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareCatalogVariationExternalId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareCatalogVariationExternalIdIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareCatalogVariationExternalId\(/);

  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  const catalogEnd = squareSource.indexOf("function squareHeaders(");
  assert.ok(catalogStart > 0 && catalogEnd > catalogStart);
  const catalogBody = squareSource.slice(catalogStart, catalogEnd);
  assert.match(catalogBody, /normalizeSquareCatalogVariationExternalId\(/);
  assert.doesNotMatch(catalogBody, /stringField\(row,\s*"id"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (item id, item name, variation name).
  assert.match(catalogBody, /stringField\(record,\s*"id"/);
  assert.match(catalogBody, /stringField\(itemData,\s*"name"/);
  assert.match(catalogBody, /stringField\(variationData,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square catalog variation external ids stable", () => {
  assert.equal(asciiTrimSquareCatalogVariationExternalId(`  ${variationId}  `), variationId);
  assert.equal(asciiTrimSquareCatalogVariationExternalId(`\t${variationId}\n`), variationId);
  assert.equal(canonicalizeSquareCatalogVariationExternalId(`  ${variationId}  `), variationId);
  assert.equal(normalizeSquareCatalogVariationExternalId(`  ${variationId}  `), variationId);

  assert.equal(normalizeSquareCatalogVariationExternalId(accentedId), accentedId);
  assert.equal(canonicalizeSquareCatalogVariationExternalId(accentedId), accentedId);

  const catalog = normalizeCatalogItem(
    catalogItem([
      {
        id: `  ${variationId}  `,
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.external_catalog_item_id, "item-1");
  assert.equal(catalog[0]?.external_variation_id, variationId);
  assert.equal(catalog[0]?.external_name, "Burger");
});

test("Unicode em-space / NBSP padding cannot invent clean Square catalog variation external ids", () => {
  const padded = `${em}${variationId}${em}`;
  const nbspId = `${nbsp}${variationId}${nbsp}`;
  const internalEm = `VAR${em}ABC`;
  const internalNbsp = `VAR${nbsp}ABC`;

  // Inventing proof: Unicode trim would invent the clean external variation id.
  assert.equal(padded.trim(), variationId);
  assert.equal(nbspId.trim(), variationId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareCatalogVariationExternalId(padded), padded);
  assert.equal(canonicalizeSquareCatalogVariationExternalId(padded), null);
  assert.equal(canonicalizeSquareCatalogVariationExternalId(nbspId), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(padded), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(nbspId), null);

  // Soft empty still fails closed without inventing an external id from padding alone.
  assert.equal(normalizeSquareCatalogVariationExternalId(`${em}${em}`), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(`${nbsp}`), null);
  assert.equal(normalizeSquareCatalogVariationExternalId("   "), null);

  // Live normalizeCatalogItem must not invent a clean external_variation_id
  // from padded id; soft-null collapses to the intentional empty string.
  const invented = normalizeCatalogItem(
    catalogItem([
      {
        id: padded,
        item_variation_data: { name: "Regular" }
      },
      {
        id: variationId,
        item_variation_data: { name: "Large" }
      }
    ])
  );
  assert.equal(invented.length, 2);
  assert.equal(invented[0]?.external_variation_id, "");
  assert.equal(invented[0]?.external_name, "Burger");
  assert.equal(invented[1]?.external_variation_id, variationId);
  assert.equal(invented[1]?.external_name, "Burger — Large");

  const softEmpty = normalizeCatalogItem(
    catalogItem([
      {
        id: em,
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.external_variation_id, "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareCatalogVariationExternalId(internalEm), internalEm);
  assert.equal(normalizeSquareCatalogVariationExternalId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareCatalogVariationExternalId(internalEm), internalEm);

  const internalCatalog = normalizeCatalogItem(
    catalogItem([
      {
        id: internalEm,
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(internalCatalog.length, 1);
  assert.equal(internalCatalog[0]?.external_variation_id, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square catalog variation external ids", () => {
  assert.equal(normalizeSquareCatalogVariationExternalId(undefined), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(null), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(""), null);
  assert.equal(normalizeSquareCatalogVariationExternalId("   "), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(123 as unknown as string), null);
  assert.equal(normalizeSquareCatalogVariationExternalId(`\u0001${variationId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareCatalogVariationExternalId(`${variationId}\t`), variationId);
  assert.equal(normalizeSquareCatalogVariationExternalId(`${variationId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareCatalogVariationExternalId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareCatalogVariationExternalId("x".repeat(129)), null);
  assert.equal(normalizeSquareCatalogVariationExternalId("x".repeat(128)), "x".repeat(128));

  // Missing id still collapses to the intentional empty external variation id.
  const missingId = normalizeCatalogItem(
    catalogItem([
      {
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(missingId.length, 1);
  assert.equal(missingId[0]?.external_variation_id, "");
  assert.equal(missingId[0]?.external_catalog_item_id, "item-1");
});
