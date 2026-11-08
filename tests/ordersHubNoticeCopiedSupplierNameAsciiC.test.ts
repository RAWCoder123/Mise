import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersHubNoticeCopiedSupplierName,
  canonicalizeOrdersHubNoticeCopiedSupplierName,
  normalizeOrdersHubNoticeCopiedSupplierName
} from "../services/domain/presentationOrdersHubNoticeCopiedSupplierNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationOrdersHubNoticeCopiedSupplierNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const ordersSource = readFileSync(
  new URL("../app/(tabs)/orders.tsx", import.meta.url),
  "utf8"
);
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005AAC pins Orders hub notice.copied supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005AAC/);
  assert.match(ordersSource, /MISE-005AAC/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersHubNoticeCopiedSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    ordersSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOrdersHubNoticeCopiedSupplierNameIdentity"/
  );
  assert.match(ordersSource, /normalizeOrdersHubNoticeCopiedSupplierName\(/);
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeCopiedSupplierName\(order\.supplier_name\)\s*\|\|\s*t\("orders\.notice\.supplierName\.none"\)/
  );
  assert.doesNotMatch(
    ordersSource,
    /t\("orders\.notice\.copied", \{\s*supplier:\s*order\.supplier_name\s*\}\)/
  );

  assert.match(catalogSource, /"orders\.notice\.supplierName\.none": "Supplier"/);
  assert.match(catalogSource, /"orders\.notice\.supplierName\.none": "Proveedor"/);
  assert.match(catalogSource, /"orders\.notice\.supplierName\.none": "供应商"/);

  // Leave sibling item_name / supplier_name tips alone.
  assert.doesNotMatch(ordersSource, /normalizeOrdersHubNoticeItemName/);
  assert.doesNotMatch(ordersSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(ordersSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(ordersSource, /normalizeOrdersDetailTitleSupplierName/);
  assert.doesNotMatch(ordersSource, /normalizeOrdersDetailActionA11ySupplierName/);
  assert.doesNotMatch(identitySource, /presentationOrdersHubNoticeItemNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave order_copied telemetry on the raw supplier_name field.
  assert.match(
    ordersSource,
    /trackMiseEvent\("order_copied", \{[\s\S]*?supplier_name:\s*order\.supplier_name/
  );

  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(supplierName), supplierName);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeOrdersHubNoticeCopiedSupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Orders hub copied supplier names", () => {
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
  assert.equal(asciiTrimOrdersHubNoticeCopiedSupplierName(padded), padded);
  assert.equal(canonicalizeOrdersHubNoticeCopiedSupplierName(padded), null);
  assert.equal(canonicalizeOrdersHubNoticeCopiedSupplierName(nbspName), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(padded), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(nbspName), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOrdersHubNoticeCopiedSupplierName(internalEm), internalEm);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Orders hub copied supplier names", () => {
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(null), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(undefined), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(""), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName("   "), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(123 as unknown as string), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(em), null);
});

test("Orders hub copied-notice bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still interpolated blank-looking supplier
  // identity into StatusNotice copied copy.
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(""), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(em), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(nbsp), null);
  assert.match(
    ordersSource,
    /normalizeOrdersHubNoticeCopiedSupplierName\(order\.supplier_name\)\s*\|\|\s*t\("orders\.notice\.supplierName\.none"\)/
  );
});

test("Orders hub copied-notice supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimOrdersHubNoticeCopiedSupplierName(padded), padded.trim());
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(padded), null);
  assert.equal(normalizeOrdersHubNoticeCopiedSupplierName(`\t${supplierName}\n`), supplierName);
});
