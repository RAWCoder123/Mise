import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierDraftCardSupplierName,
  canonicalizeSupplierDraftCardSupplierName,
  normalizeSupplierDraftCardSupplierName
} from "../services/domain/presentationSupplierDraftCardSupplierNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationSupplierDraftCardSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const cardSource = readFileSync(new URL("../components/SupplierDraftCard.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WP pins SupplierDraftCard supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WP/);
  assert.match(cardSource, /MISE-005WP/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierDraftCardSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    cardSource,
    /from "\.\.\/services\/domain\/presentationSupplierDraftCardSupplierNameIdentity"/
  );
  assert.match(cardSource, /normalizeSupplierDraftCardSupplierName\(/);
  assert.match(
    cardSource,
    /normalizeSupplierDraftCardSupplierName\(order\.supplier_name\)\s*\|\|\s*t\("orders\.card\.supplier\.none"\)/
  );
  assert.doesNotMatch(
    cardSource,
    /<Text style=\{styles\.supplierName\} numberOfLines=\{1\}>\s*\{order\.supplier_name\}\s*<\/Text>/
  );

  assert.match(catalogSource, /"orders\.card\.supplier\.none": "Supplier"/);
  assert.match(catalogSource, /"orders\.card\.supplier\.none": "Proveedor"/);
  assert.match(catalogSource, /"orders\.card\.supplier\.none": "供应商"/);

  // Leave line item names as raw presentation pass-through on this tip.
  assert.match(cardSource, /\{line\.itemName\}/);

  // Leave Orders detail title supplier_name alone on main (open #1016).
  assert.doesNotMatch(cardSource, /normalizeOrdersDetailTitleSupplierName/);
  assert.doesNotMatch(identitySource, /presentationOrdersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationDraftOrderSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  assert.equal(normalizeSupplierDraftCardSupplierName(supplierName), supplierName);
  assert.equal(normalizeSupplierDraftCardSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeSupplierDraftCardSupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for SupplierDraftCard supplier names", () => {
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
  assert.equal(asciiTrimSupplierDraftCardSupplierName(padded), padded);
  assert.equal(canonicalizeSupplierDraftCardSupplierName(padded), null);
  assert.equal(canonicalizeSupplierDraftCardSupplierName(nbspName), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(padded), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(nbspName), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSupplierDraftCardSupplierName(internalEm), internalEm);
  assert.equal(normalizeSupplierDraftCardSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeSupplierDraftCardSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for SupplierDraftCard supplier names", () => {
  assert.equal(normalizeSupplierDraftCardSupplierName(undefined), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(null), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(""), null);
  assert.equal(normalizeSupplierDraftCardSupplierName("   "), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(123 as unknown as string), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSupplierDraftCardSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeSupplierDraftCardSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(em), null);
});

test("SupplierDraftCard bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking supplierName Text.
  assert.equal(normalizeSupplierDraftCardSupplierName(""), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(em), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(nbsp), null);
  assert.match(
    cardSource,
    /normalizeSupplierDraftCardSupplierName\(order\.supplier_name\)\s*\|\|\s*t\("orders\.card\.supplier\.none"\)/
  );
});

test("SupplierDraftCard supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimSupplierDraftCardSupplierName(padded), padded.trim());
  assert.equal(normalizeSupplierDraftCardSupplierName(padded), null);
  assert.equal(normalizeSupplierDraftCardSupplierName(`\t${supplierName}\n`), supplierName);
});
