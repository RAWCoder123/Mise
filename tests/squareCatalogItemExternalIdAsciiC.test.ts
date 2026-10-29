import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareCatalogItemExternalId,
  canonicalizeSquareCatalogItemExternalId,
  normalizeSquareCatalogItemExternalId
} from "../services/domain/squareCatalogItemExternalIdIdentity";
import { normalizeCatalogItem } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareCatalogItemExternalIdIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const itemId = "item-1";
const accentedId = "Café-Item-1";
const em = "\u2003";
const nbsp = "\u00a0";

function catalogItem(id: unknown, variations: unknown[]) {
  return {
    type: "ITEM",
    id,
    item_data: {
      name: "Burger",
      product_type: "REGULAR",
      variations
    }
  };
}

test("MISE-005TH pins Square catalog item external_catalog_item_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005TH/);
  assert.match(squareSource, /MISE-005TH/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareCatalogItemExternalId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareCatalogItemExternalIdIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareCatalogItemExternalId\(/);

  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  const catalogEnd = squareSource.indexOf("function squareHeaders(");
  assert.ok(catalogStart > 0 && catalogEnd > catalogStart);
  const catalogBody = squareSource.slice(catalogStart, catalogEnd);
  assert.match(catalogBody, /normalizeSquareCatalogItemExternalId\(/);
  assert.doesNotMatch(catalogBody, /stringField\(record,\s*"id"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (variation id, item name, variation name).
  assert.match(catalogBody, /stringField\(row,\s*"id"/);
  assert.match(catalogBody, /stringField\(itemData,\s*"name"/);
  assert.match(catalogBody, /stringField\(variationData,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareCatalogVariationExternalIdIdentity/);
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

test("ASCII C prep keeps ordinary Square catalog item external ids stable", () => {
  assert.equal(asciiTrimSquareCatalogItemExternalId(`  ${itemId}  `), itemId);
  assert.equal(asciiTrimSquareCatalogItemExternalId(`\t${itemId}\n`), itemId);
  assert.equal(canonicalizeSquareCatalogItemExternalId(`  ${itemId}  `), itemId);
  assert.equal(normalizeSquareCatalogItemExternalId(`  ${itemId}  `), itemId);

  assert.equal(normalizeSquareCatalogItemExternalId(accentedId), accentedId);
  assert.equal(canonicalizeSquareCatalogItemExternalId(accentedId), accentedId);

  const catalog = normalizeCatalogItem(
    catalogItem(`  ${itemId}  `, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.external_catalog_item_id, itemId);
  assert.equal(catalog[0]?.external_variation_id, "var-1");
  assert.equal(catalog[0]?.external_name, "Burger");
});

test("Unicode em-space / NBSP padding cannot invent clean Square catalog item external ids", () => {
  const padded = `${em}${itemId}${em}`;
  const nbspId = `${nbsp}${itemId}${nbsp}`;
  const internalEm = `ITEM${em}ABC`;
  const internalNbsp = `ITEM${nbsp}ABC`;

  // Inventing proof: Unicode trim would invent the clean external catalog item id.
  assert.equal(padded.trim(), itemId);
  assert.equal(nbspId.trim(), itemId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareCatalogItemExternalId(padded), padded);
  assert.equal(canonicalizeSquareCatalogItemExternalId(padded), null);
  assert.equal(canonicalizeSquareCatalogItemExternalId(nbspId), null);
  assert.equal(normalizeSquareCatalogItemExternalId(padded), null);
  assert.equal(normalizeSquareCatalogItemExternalId(nbspId), null);

  // Soft empty still fails closed without inventing an external id from padding alone.
  assert.equal(normalizeSquareCatalogItemExternalId(`${em}${em}`), null);
  assert.equal(normalizeSquareCatalogItemExternalId(`${nbsp}`), null);
  assert.equal(normalizeSquareCatalogItemExternalId("   "), null);

  // Live normalizeCatalogItem must not invent a clean external_catalog_item_id
  // from padded id; soft-null collapses to the intentional empty string and
  // the variation-row filter drops the invented-authority rows.
  const invented = normalizeCatalogItem(
    catalogItem(padded, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      },
      {
        id: "var-2",
        item_variation_data: { name: "Large" }
      }
    ])
  );
  assert.equal(invented.length, 0);

  const softEmpty = normalizeCatalogItem(
    catalogItem(em, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(softEmpty.length, 0);

  // No-variation path also refuses invented clean catalog item identity.
  const noVariationInvented = normalizeCatalogItem(catalogItem(padded, []));
  assert.equal(noVariationInvented.length, 1);
  assert.equal(noVariationInvented[0]?.external_catalog_item_id, "");
  assert.equal(noVariationInvented[0]?.external_variation_id, "");
  assert.equal(noVariationInvented[0]?.external_name, "Burger");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareCatalogItemExternalId(internalEm), internalEm);
  assert.equal(normalizeSquareCatalogItemExternalId(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareCatalogItemExternalId(internalEm), internalEm);

  const internalCatalog = normalizeCatalogItem(
    catalogItem(internalEm, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(internalCatalog.length, 1);
  assert.equal(internalCatalog[0]?.external_catalog_item_id, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square catalog item external ids", () => {
  assert.equal(normalizeSquareCatalogItemExternalId(undefined), null);
  assert.equal(normalizeSquareCatalogItemExternalId(null), null);
  assert.equal(normalizeSquareCatalogItemExternalId(""), null);
  assert.equal(normalizeSquareCatalogItemExternalId("   "), null);
  assert.equal(normalizeSquareCatalogItemExternalId(123 as unknown as string), null);
  assert.equal(normalizeSquareCatalogItemExternalId(`\u0001${itemId}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareCatalogItemExternalId(`${itemId}\t`), itemId);
  assert.equal(normalizeSquareCatalogItemExternalId(`${itemId}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareCatalogItemExternalId(em), null);
  // Overlong tokens fail closed (prior stringField max 128).
  assert.equal(normalizeSquareCatalogItemExternalId("x".repeat(129)), null);
  assert.equal(normalizeSquareCatalogItemExternalId("x".repeat(128)), "x".repeat(128));

  // Missing id still collapses to the intentional empty external catalog item id.
  const missingId = normalizeCatalogItem(
    catalogItem(undefined, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(missingId.length, 0);

  const missingNoVariation = normalizeCatalogItem(catalogItem(undefined, []));
  assert.equal(missingNoVariation.length, 1);
  assert.equal(missingNoVariation[0]?.external_catalog_item_id, "");
});
