import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSquareCatalogCategory,
  canonicalizeSquareCatalogCategory,
  normalizeSquareCatalogCategory
} from "../services/domain/squareCatalogCategoryIdentity";
import { normalizeCatalogItem } from "../supabase/functions/_shared/square.ts";

const identitySource = readFileSync(
  new URL("../services/domain/squareCatalogCategoryIdentity.ts", import.meta.url),
  "utf8"
);
const squareSource = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);

const itemName = "Burger";
const productType = "REGULAR";
const categoryId = "CAT123";
const accentedCategory = "Café";
const em = "\u2003";
const nbsp = "\u00a0";

function catalogItem(overrides: {
  product_type?: unknown;
  category_id?: unknown;
  variations?: unknown[];
} = {}) {
  const itemData: Record<string, unknown> = {
    name: itemName,
    variations: overrides.variations ?? [
      {
        id: "var-1",
        item_variation_data: { name: "Regular" }
      }
    ]
  };
  if ("product_type" in overrides) {
    itemData.product_type = overrides.product_type;
  } else if (!("category_id" in overrides)) {
    itemData.product_type = productType;
  }
  if ("category_id" in overrides) {
    itemData.category_id = overrides.category_id;
  }
  return {
    type: "ITEM",
    id: "item-1",
    item_data: itemData
  };
}

test("MISE-005TN pins Square catalog category to ASCII C", () => {
  assert.match(identitySource, /MISE-005TN/);
  assert.match(squareSource, /MISE-005TN/);

  assert.match(
    identitySource,
    /export function asciiTrimSquareCatalogCategory\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    squareSource,
    /from "\.\.\/\.\.\/\.\.\/services\/domain\/squareCatalogCategoryIdentity\.ts"/
  );
  assert.match(squareSource, /normalizeSquareCatalogCategory\(/);

  const catalogStart = squareSource.indexOf("export function normalizeCatalogItem(");
  const catalogEnd = squareSource.indexOf("function squareHeaders(");
  assert.ok(catalogStart > 0 && catalogEnd > catalogStart);
  const catalogBody = squareSource.slice(catalogStart, catalogEnd);
  assert.match(catalogBody, /normalizeSquareCatalogCategory\(/);
  assert.doesNotMatch(catalogBody, /stringField\(itemData,\s*"product_type"/);
  assert.doesNotMatch(catalogBody, /stringField\(itemData,\s*"category_id"/);

  // Leave sibling stringField call sites on their existing Unicode trim
  // contract for separate tips (catalog item id, item name, variation id,
  // variation name).
  assert.match(catalogBody, /stringField\(record,\s*"id"/);
  assert.match(catalogBody, /stringField\(itemData,\s*"name"/);
  assert.match(catalogBody, /stringField\(row,\s*"id"/);
  assert.match(catalogBody, /stringField\(variationData,\s*"name"/);

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /squareCatalogVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalNameIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogItemExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareCatalogVariationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleVariationNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderVariationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationExternalIdIdentity/);
  assert.doesNotMatch(identityCode, /squareLocationDisplayNameIdentity/);
  assert.doesNotMatch(identityCode, /squareMerchantIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleSourceRecordOrderIdIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleLineUidIdentity/);
  assert.doesNotMatch(identityCode, /squareOrderSaleClosedAtIdentity/);
  assert.doesNotMatch(identityCode, /squareIntegrationErrorMessageIdentity/);
  assert.doesNotMatch(identityCode, /verifiedProviderLocationIdIdentity/);
  assert.doesNotMatch(identityCode, /askMiseTopSaleItemNameIdentity/);
  assert.doesNotMatch(identityCode, /providerSaleIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C prep keeps ordinary Square catalog categories stable", () => {
  assert.equal(asciiTrimSquareCatalogCategory(`  ${productType}  `), productType);
  assert.equal(asciiTrimSquareCatalogCategory(`\t${productType}\n`), productType);
  assert.equal(canonicalizeSquareCatalogCategory(`  ${productType}  `), productType);
  assert.equal(normalizeSquareCatalogCategory(`  ${productType}  `), productType);

  assert.equal(normalizeSquareCatalogCategory(accentedCategory), accentedCategory);
  assert.equal(canonicalizeSquareCatalogCategory(accentedCategory), accentedCategory);

  const fromProductType = normalizeCatalogItem(catalogItem());
  assert.equal(fromProductType.length, 1);
  assert.equal(fromProductType[0]?.external_catalog_item_id, "item-1");
  assert.equal(fromProductType[0]?.category, productType);

  const asciiPaddedProduct = normalizeCatalogItem(
    catalogItem({ product_type: `  ${productType}  ` })
  );
  assert.equal(asciiPaddedProduct.length, 1);
  assert.equal(asciiPaddedProduct[0]?.category, productType);

  const fromCategoryId = normalizeCatalogItem(
    catalogItem({ product_type: "", category_id: `  ${categoryId}  ` })
  );
  assert.equal(fromCategoryId.length, 1);
  assert.equal(fromCategoryId[0]?.category, categoryId);

  const missingBoth = normalizeCatalogItem(
    catalogItem({ product_type: "", category_id: "" })
  );
  assert.equal(missingBoth.length, 1);
  assert.equal(missingBoth[0]?.category, "Square");
});

test("Unicode em-space / NBSP padding cannot invent clean Square catalog categories", () => {
  const padded = `${em}${productType}${em}`;
  const nbspType = `${nbsp}${productType}${nbsp}`;
  const paddedCategoryId = `${em}${categoryId}${em}`;
  const nbspCategoryId = `${nbsp}${categoryId}${nbsp}`;
  const internalEm = `REG${em}ULAR`;
  const internalNbsp = `REG${nbsp}ULAR`;

  // Inventing proof: Unicode trim would invent the clean catalog category.
  assert.equal(padded.trim(), productType);
  assert.equal(nbspType.trim(), productType);
  assert.equal(paddedCategoryId.trim(), categoryId);
  assert.equal(nbspCategoryId.trim(), categoryId);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSquareCatalogCategory(padded), padded);
  assert.equal(canonicalizeSquareCatalogCategory(padded), null);
  assert.equal(canonicalizeSquareCatalogCategory(nbspType), null);
  assert.equal(normalizeSquareCatalogCategory(padded), null);
  assert.equal(normalizeSquareCatalogCategory(nbspType), null);
  assert.equal(normalizeSquareCatalogCategory(paddedCategoryId), null);
  assert.equal(normalizeSquareCatalogCategory(nbspCategoryId), null);

  // Soft empty still fails closed without inventing a category from padding alone.
  assert.equal(normalizeSquareCatalogCategory(`${em}${em}`), null);
  assert.equal(normalizeSquareCatalogCategory(`${nbsp}`), null);
  assert.equal(normalizeSquareCatalogCategory("   "), null);

  // Live normalizeCatalogItem must not invent a clean category from padded
  // product_type; soft-null falls through to category_id / "Square" without
  // inventing REGULAR from padding.
  const inventedProductType = normalizeCatalogItem(
    catalogItem({ product_type: padded })
  );
  assert.equal(inventedProductType.length, 1);
  assert.equal(inventedProductType[0]?.category, "Square");
  assert.notEqual(inventedProductType[0]?.category, productType);

  const inventedNbspProductType = normalizeCatalogItem(
    catalogItem({ product_type: nbspType })
  );
  assert.equal(inventedNbspProductType.length, 1);
  assert.equal(inventedNbspProductType[0]?.category, "Square");
  assert.notEqual(inventedNbspProductType[0]?.category, productType);

  // Padded product_type must not invent REGULAR and must still allow a clean
  // category_id fallback when present.
  const paddedProductCleanCategoryId = normalizeCatalogItem(
    catalogItem({ product_type: padded, category_id: categoryId })
  );
  assert.equal(paddedProductCleanCategoryId.length, 1);
  assert.equal(paddedProductCleanCategoryId[0]?.category, categoryId);
  assert.notEqual(paddedProductCleanCategoryId[0]?.category, productType);

  // Both padded → fail closed to "Square" without inventing either padded token.
  const bothPadded = normalizeCatalogItem(
    catalogItem({ product_type: padded, category_id: paddedCategoryId })
  );
  assert.equal(bothPadded.length, 1);
  assert.equal(bothPadded[0]?.category, "Square");
  assert.notEqual(bothPadded[0]?.category, productType);
  assert.notEqual(bothPadded[0]?.category, categoryId);

  // Internal Unicode padding is preserved (not end-trimmed away), matching
  // sibling Square catalog ASCII C tips.
  assert.equal(canonicalizeSquareCatalogCategory(internalEm), internalEm);
  assert.equal(normalizeSquareCatalogCategory(internalNbsp), internalNbsp);
  assert.equal(normalizeSquareCatalogCategory(internalEm), internalEm);

  const internal = normalizeCatalogItem(
    catalogItem({ product_type: internalEm })
  );
  assert.equal(internal.length, 1);
  assert.equal(internal[0]?.category, internalEm);
});

test("soft empty, controls, overlong, and non-strings fail closed for Square catalog category", () => {
  assert.equal(normalizeSquareCatalogCategory(undefined), null);
  assert.equal(normalizeSquareCatalogCategory(null), null);
  assert.equal(normalizeSquareCatalogCategory(""), null);
  assert.equal(normalizeSquareCatalogCategory("   "), null);
  assert.equal(normalizeSquareCatalogCategory(123 as unknown as string), null);
  assert.equal(normalizeSquareCatalogCategory(`\u0001${productType}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSquareCatalogCategory(`${productType}\t`), productType);
  assert.equal(normalizeSquareCatalogCategory(`${productType}\u0007`), null);
  // Overly padded Unicode-only space soft-empties without inventing a token.
  assert.equal(normalizeSquareCatalogCategory(em), null);
  // Overlong tokens fail closed (prior stringField max 80).
  assert.equal(normalizeSquareCatalogCategory("x".repeat(81)), null);
  assert.equal(normalizeSquareCatalogCategory("x".repeat(80)), "x".repeat(80));

  const missingCategory = normalizeCatalogItem(
    catalogItem({ product_type: undefined, category_id: undefined })
  );
  assert.equal(missingCategory.length, 1);
  assert.equal(missingCategory[0]?.category, "Square");
  assert.notEqual(missingCategory[0]?.category, productType);
});

test("MISE-005TN leaves sibling Square catalog stringField identities alone", () => {
  const catalog = normalizeCatalogItem({
    type: "ITEM",
    id: "item-1",
    item_data: {
      name: itemName,
      product_type: productType,
      variations: [
        {
          id: "var-1",
          item_variation_data: { name: "Large" }
        }
      ]
    }
  });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.category, productType);
  assert.equal(catalog[0]?.external_catalog_item_id, "item-1");
  assert.equal(catalog[0]?.external_variation_id, "var-1");
  assert.equal(catalog[0]?.external_name, `${itemName} — Large`);
});
