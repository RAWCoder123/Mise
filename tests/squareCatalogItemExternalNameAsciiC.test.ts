import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareCatalogItemExternalName,
  canonicalizeSquareCatalogItemExternalName,
  normalizeSquareCatalogItemExternalName
} from "../services/domain/squareCatalogItemExternalNameIdentity";
import { normalizeCatalogItem } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareCatalogItemExternalNameIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const itemName = "Burger";
const accentedName = "Café Burger";
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

test("MISE-005TI pins Square catalog item external_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005TI/);
  assert.match(squareSource, /MISE-005TI/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareCatalogItemExternalName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareCatalogItemExternalNameIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareCatalogItemExternalName\(/);

  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  const catalogEnd = squareSource.indexOf("function squareHeaders(");
  assert.ok(catalogStart > 0 && catalogEnd > catalogStart);
  const catalogBody = squareSource.slice(catalogStart, catalogEnd);
  assert.match(catalogBody, /normalizeSquareCatalogItemExternalName\(/);
  assert.doesNotMatch(catalogBody, /stringField\(itemData,\s*"name"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (catalog item id, variation id, variation name).
  assert.match(catalogBody, /stringField\(record,\s*"id"/);
  assert.match(catalogBody, /stringField\(row,\s*"id"/);
  assert.match(catalogBody, /stringField\(variationData,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
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

test("ASCII C prep keeps ordinary Square catalog item external names stable", () => {
  assert.equal(asciiTrimSquareCatalogItemExternalName(`  ${itemName}  `), itemName);
  assert.equal(asciiTrimSquareCatalogItemExternalName(`\t${itemName}\n`), itemName);
  assert.equal(canonicalizeSquareCatalogItemExternalName(`  ${itemName}  `), itemName);
  assert.equal(normalizeSquareCatalogItemExternalName(`  ${itemName}  `), itemName);

  assert.equal(normalizeSquareCatalogItemExternalName(accentedName), accentedName);
  assert.equal(canonicalizeSquareCatalogItemExternalName(accentedName), accentedName);

  const catalog = normalizeCatalogItem(
    catalogItem(`  ${itemName}  `, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.external_catalog_item_id, "item-1");
  assert.equal(catalog[0]?.external_variation_id, "var-1");
  assert.equal(catalog[0]?.external_name, itemName);

  const composed = normalizeCatalogItem(
    catalogItem(`  ${itemName}  `, [
      {
        id: "var-2",
        item_variation_data: { name: "Large" }
      }
    ])
  );
  assert.equal(composed.length, 1);
  assert.equal(composed[0]?.external_name, `${itemName} — Large`);
});

test("Unicode em-space / NBSP padding cannot invent clean Square catalog item external names", () => {
  const padded = `${em}${itemName}${em}`;
  const nbspName = `${nbsp}${itemName}${nbsp}`;
  const internalEm = `Burger${em}Deluxe`;
  const internalNbsp = `Burger${nbsp}Deluxe`;

  // Inventing proof: Unicode trim would invent the clean catalog external name.
  assert.equal(padded.trim(), itemName);
  assert.equal(nbspName.trim(), itemName);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareCatalogItemExternalName(padded), padded);
  assert.equal(canonicalizeSquareCatalogItemExternalName(padded), null);
  assert.equal(canonicalizeSquareCatalogItemExternalName(nbspName), null);
  assert.equal(normalizeSquareCatalogItemExternalName(padded), null);
  assert.equal(normalizeSquareCatalogItemExternalName(nbspName), null);

  // Soft empty still fails closed without inventing an external name from padding alone.
  assert.equal(normalizeSquareCatalogItemExternalName(`${em}${em}`), null);
  assert.equal(normalizeSquareCatalogItemExternalName(`${nbsp}`), null);
  assert.equal(normalizeSquareCatalogItemExternalName("   "), null);

  // Live normalizeCatalogItem must not invent a clean external_name from
  // padded item name; soft-null collapses to the intentional "Untitled item"
  // fallback instead of inventing the clean operator-facing label.
  const invented = normalizeCatalogItem(
    catalogItem(padded, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(invented.length, 1);
  assert.equal(invented[0]?.external_name, "Untitled item");
  assert.equal(invented[0]?.external_catalog_item_id, "item-1");

  const inventedComposed = normalizeCatalogItem(
    catalogItem(padded, [
      {
        id: "var-2",
        item_variation_data: { name: "Large" }
      }
    ])
  );
  assert.equal(inventedComposed.length, 1);
  assert.equal(inventedComposed[0]?.external_name, "Untitled item — Large");

  const softEmpty = normalizeCatalogItem(
    catalogItem(em, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(softEmpty.length, 1);
  assert.equal(softEmpty[0]?.external_name, "Untitled item");

  // No-variation path also refuses invented clean catalog external name.
  const noVariationInvented = normalizeCatalogItem(catalogItem(padded, []));
  assert.equal(noVariationInvented.length, 1);
  assert.equal(noVariationInvented[0]?.external_name, "Untitled item");
  assert.equal(noVariationInvented[0]?.external_catalog_item_id, "item-1");
  assert.equal(noVariationInvented[0]?.external_variation_id, "");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSquareCatalogItemExternalName(internalEm), internalEm);
  assert.equal(normalizeSquareCatalogItemExternalName(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareCatalogItemExternalName(internalEm), internalEm);

  const internalCatalog = normalizeCatalogItem(
    catalogItem(internalEm, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(internalCatalog.length, 1);
  assert.equal(internalCatalog[0]?.external_name, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square catalog item external names", () => {
  assert.equal(normalizeSquareCatalogItemExternalName(undefined), null);
  assert.equal(normalizeSquareCatalogItemExternalName(null), null);
  assert.equal(normalizeSquareCatalogItemExternalName(""), null);
  assert.equal(normalizeSquareCatalogItemExternalName("   "), null);
  assert.equal(normalizeSquareCatalogItemExternalName(123 as unknown as string), null);
  assert.equal(normalizeSquareCatalogItemExternalName(`\u0001${itemName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareCatalogItemExternalName(`${itemName}\t`), itemName);
  assert.equal(normalizeSquareCatalogItemExternalName(`${itemName}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareCatalogItemExternalName(em), null);
  // Overlong tokens fail closed (prior stringField max 160).
  assert.equal(normalizeSquareCatalogItemExternalName("x".repeat(161)), null);
  assert.equal(normalizeSquareCatalogItemExternalName("x".repeat(160)), "x".repeat(160));

  // Missing name still collapses to the intentional Untitled item fallback.
  const missingName = normalizeCatalogItem(
    catalogItem(undefined, [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ])
  );
  assert.equal(missingName.length, 1);
  assert.equal(missingName[0]?.external_name, "Untitled item");

  const missingNoVariation = normalizeCatalogItem(catalogItem(undefined, []));
  assert.equal(missingNoVariation.length, 1);
  assert.equal(missingNoVariation[0]?.external_name, "Untitled item");
});
