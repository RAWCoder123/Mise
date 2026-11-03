import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryDetailSupplierName,
  canonicalizeInventoryDetailSupplierName,
  normalizeInventoryDetailSupplierName
} from "../services/domain/presentationInventoryDetailSupplierNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationInventoryDetailSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const detailSource = readFileSync(new URL("../app/inventory/[id].tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005WR pins Inventory detail supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005WR/);
  assert.match(detailSource, /MISE-005WR/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryDetailSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    detailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInventoryDetailSupplierNameIdentity"/
  );
  assert.match(detailSource, /normalizeInventoryDetailSupplierName\(/);
  assert.match(
    detailSource,
    /normalizeInventoryDetailSupplierName\(\s*item\.supplier_name\s*\)\s*\|\|\s*t\("inventory\.detail\.supplierName\.none"\)/
  );
  assert.doesNotMatch(
    detailSource,
    /subtitle=\{item \? `\$\{item\.supplier_name\} · \$\{item\.category\}`/
  );

  assert.match(catalogSource, /"inventory\.detail\.supplierName\.none": "Supplier"/);
  assert.match(catalogSource, /"inventory\.detail\.supplierName\.none": "Proveedor"/);
  assert.match(catalogSource, /"inventory\.detail\.supplierName\.none": "供应商"/);

  // Leave sibling supplier_name / category / title tips alone on this tip.
  assert.doesNotMatch(detailSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(detailSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(detailSource, /normalizeOrdersDetailTitleSupplierName/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /ordersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave Inventory detail title item.item_name and category alone.
  assert.match(detailSource, /title=\{item\?\.item_name \?\? t\("inventory\.detail\.title"\)\}/);
  assert.match(
    detailSource,
    /`\$\{inventoryDetailDisplaySupplierName\} · \$\{item\.category\}`/
  );

  assert.equal(normalizeInventoryDetailSupplierName(supplierName), supplierName);
  assert.equal(normalizeInventoryDetailSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeInventoryDetailSupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Inventory detail supplier names", () => {
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
  assert.equal(asciiTrimInventoryDetailSupplierName(padded), padded);
  assert.equal(canonicalizeInventoryDetailSupplierName(padded), null);
  assert.equal(canonicalizeInventoryDetailSupplierName(nbspName), null);
  assert.equal(normalizeInventoryDetailSupplierName(padded), null);
  assert.equal(normalizeInventoryDetailSupplierName(nbspName), null);
  assert.equal(normalizeInventoryDetailSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeInventoryDetailSupplierName(internalEm), internalEm);
  assert.equal(normalizeInventoryDetailSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeInventoryDetailSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Inventory detail supplier names", () => {
  assert.equal(normalizeInventoryDetailSupplierName(undefined), null);
  assert.equal(normalizeInventoryDetailSupplierName(null), null);
  assert.equal(normalizeInventoryDetailSupplierName(""), null);
  assert.equal(normalizeInventoryDetailSupplierName("   "), null);
  assert.equal(normalizeInventoryDetailSupplierName(123 as unknown as string), null);
  assert.equal(normalizeInventoryDetailSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeInventoryDetailSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeInventoryDetailSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeInventoryDetailSupplierName(em), null);
});

test("Inventory detail bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still rendered blank-looking supplier before
  // the category separator (`" · Produce"` / `"  · Produce"`).
  assert.equal(normalizeInventoryDetailSupplierName(""), null);
  assert.equal(normalizeInventoryDetailSupplierName(em), null);
  assert.equal(normalizeInventoryDetailSupplierName(nbsp), null);
  assert.match(
    detailSource,
    /normalizeInventoryDetailSupplierName\(\s*item\.supplier_name\s*\)\s*\|\|\s*t\("inventory\.detail\.supplierName\.none"\)/
  );
});

test("Inventory detail supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimInventoryDetailSupplierName(padded), padded.trim());
  assert.equal(normalizeInventoryDetailSupplierName(padded), null);
  assert.equal(normalizeInventoryDetailSupplierName(`\t${supplierName}\n`), supplierName);
});
