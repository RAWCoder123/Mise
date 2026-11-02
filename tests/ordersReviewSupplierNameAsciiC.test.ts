import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersReviewSupplierName,
  canonicalizeOrdersReviewSupplierName,
  normalizeOrdersReviewSupplierName
} from "../services/domain/presentationOrdersReviewSupplierNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationOrdersReviewSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const ordersSource = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WQ pins Orders review recommendation supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WQ/);
  assert.match(ordersSource, /MISE-005WQ/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersReviewSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    ordersSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOrdersReviewSupplierNameIdentity"/
  );
  assert.match(ordersSource, /normalizeOrdersReviewSupplierName\(/);
  assert.match(
    ordersSource,
    /normalizeOrdersReviewSupplierName\(\s*groupedRecommendations\[0\]\?\.supplierName\s*\)\s*\|\|\s*t\("orders\.review\.supplierName\.none"\)/
  );
  assert.match(
    ordersSource,
    /normalizeOrdersReviewSupplierName\(supplierName\)\s*\|\|\s*t\("orders\.review\.supplierName\.none"\)/
  );
  assert.doesNotMatch(
    ordersSource,
    /<Text style=\{styles\.supplierName\}>\{supplierName\}<\/Text>/
  );
  assert.doesNotMatch(
    ordersSource,
    /\? groupedRecommendations\[0\]\?\.supplierName\s*:/
  );

  assert.match(catalogSource, /"orders\.review\.supplierName\.none": "Supplier"/);
  assert.match(catalogSource, /"orders\.review\.supplierName\.none": "Proveedor"/);
  assert.match(catalogSource, /"orders\.review\.supplierName\.none": "供应商"/);

  // Leave SupplierDraftCard and Orders detail title tips alone on this tip.
  assert.doesNotMatch(ordersSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(ordersSource, /normalizeOrdersDetailTitleSupplierName/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /ordersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDraftOrderSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave orders.notice.copied order.supplier_name interpolations alone.
  assert.match(
    ordersSource,
    /t\("orders\.notice\.copied", \{ supplier: order\.supplier_name \}\)/
  );

  assert.equal(normalizeOrdersReviewSupplierName(supplierName), supplierName);
  assert.equal(normalizeOrdersReviewSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeOrdersReviewSupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Orders review supplier names", () => {
  const padded = `${em}${supplierName}${em}`;
  const nbspName = `${nbsp}${supplierName}${nbsp}`;
  const internalEm = `Sys${em}co`;
  const internalNbsp = `Sys${nbsp}co`;

  // Inventing proof: Unicode trim would invent the clean supplier name.
  assert.equal(padded.trim(), supplierName);
  assert.equal(nbspName.trim(), supplierName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimOrdersReviewSupplierName(padded), padded);
  assert.equal(canonicalizeOrdersReviewSupplierName(padded), null);
  assert.equal(canonicalizeOrdersReviewSupplierName(nbspName), null);
  assert.equal(normalizeOrdersReviewSupplierName(padded), null);
  assert.equal(normalizeOrdersReviewSupplierName(nbspName), null);
  assert.equal(normalizeOrdersReviewSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOrdersReviewSupplierName(internalEm), internalEm);
  assert.equal(normalizeOrdersReviewSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeOrdersReviewSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Orders review supplier names", () => {
  assert.equal(normalizeOrdersReviewSupplierName(undefined), null);
  assert.equal(normalizeOrdersReviewSupplierName(null), null);
  assert.equal(normalizeOrdersReviewSupplierName(""), null);
  assert.equal(normalizeOrdersReviewSupplierName("   "), null);
  assert.equal(normalizeOrdersReviewSupplierName(123 as unknown as string), null);
  assert.equal(normalizeOrdersReviewSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOrdersReviewSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeOrdersReviewSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeOrdersReviewSupplierName(em), null);
});

test("Orders review bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking supplierName Text /
  // pending title.
  assert.equal(normalizeOrdersReviewSupplierName(""), null);
  assert.equal(normalizeOrdersReviewSupplierName(em), null);
  assert.equal(normalizeOrdersReviewSupplierName(nbsp), null);
  assert.match(
    ordersSource,
    /normalizeOrdersReviewSupplierName\(supplierName\)\s*\|\|\s*t\("orders\.review\.supplierName\.none"\)/
  );
  assert.match(
    ordersSource,
    /normalizeOrdersReviewSupplierName\(\s*groupedRecommendations\[0\]\?\.supplierName\s*\)\s*\|\|\s*t\("orders\.review\.supplierName\.none"\)/
  );
});

test("Orders review supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimOrdersReviewSupplierName(padded), padded.trim());
  assert.equal(normalizeOrdersReviewSupplierName(padded), null);
  assert.equal(normalizeOrdersReviewSupplierName(`\t${supplierName}\n`), supplierName);
});
