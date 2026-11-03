import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersDetailActionSupplierName,
  canonicalizeOrdersDetailActionSupplierName,
  normalizeOrdersDetailActionSupplierName
} from "../services/domain/presentationOrdersDetailActionSupplierNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationOrdersDetailActionSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const ordersDetailSource = readFileSync(new URL("../app/orders/[id].tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");

const supplierName = "Sysco";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005XH pins Orders detail action a11y supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005XH/);
  assert.match(ordersDetailSource, /MISE-005XH/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersDetailActionSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    ordersDetailSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationOrdersDetailActionSupplierNameIdentity"/
  );
  assert.match(ordersDetailSource, /normalizeOrdersDetailActionSupplierName\(/);
  assert.match(
    ordersDetailSource,
    /normalizeOrdersDetailActionSupplierName\(visibleOrder\?\.supplier_name\)\s*\|\|\s*t\("orders\.detail\.action\.supplier\.none"\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.copyAccessibility", \{\s*supplier: actionSupplierName\s*\}\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.simulateAccessibility", \{ supplier: actionSupplierName \}\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.approveAndSendAccessibility", \{\s*supplier: actionSupplierName,\s*recipient: visibleEmailPayload\?\.to \?\? ""\s*\}\)/
  );
  assert.match(
    ordersDetailSource,
    /t\("orders\.detail\.action\.markReceivedAccessibility", \{\s*supplier: actionSupplierName\s*\}\)/
  );
  assert.doesNotMatch(
    ordersDetailSource,
    /t\("orders\.detail\.action\.copyAccessibility", \{\s*supplier: visibleOrder\.supplier_name\s*\}\)/
  );
  assert.doesNotMatch(
    ordersDetailSource,
    /t\("orders\.detail\.action\.simulateAccessibility", \{ supplier: visibleOrder\.supplier_name \}\)/
  );
  assert.doesNotMatch(
    ordersDetailSource,
    /t\("orders\.detail\.action\.markReceivedAccessibility", \{\s*supplier: visibleOrder\.supplier_name\s*\}\)/
  );

  assert.match(catalogSource, /"orders\.detail\.action\.supplier\.none": "Supplier"/);
  assert.match(catalogSource, /"orders\.detail\.action\.supplier\.none": "Proveedor"/);
  assert.match(catalogSource, /"orders\.detail\.action\.supplier\.none": "供应商"/);

  // Leave Orders detail title supplier_name alone on main (open #1016).
  assert.match(
    ordersDetailSource,
    /title=\{visibleOrder\?\.supplier_name \?\? t\("orders\.detail\.title"\)\}/
  );
  assert.doesNotMatch(ordersDetailSource, /normalizeOrdersDetailTitleSupplierName/);
  assert.doesNotMatch(ordersDetailSource, /normalizeSupplierDraftCardSupplierName/);
  assert.doesNotMatch(ordersDetailSource, /normalizeOrdersReviewSupplierName/);
  assert.doesNotMatch(identitySource, /ordersDetailTitleSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationSupplierDraftCardSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /presentationOrdersReviewSupplierNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);

  // Leave approveAndSend recipient interpolation as raw pass-through on this tip.
  assert.match(
    ordersDetailSource,
    /recipient: visibleEmailPayload\?\.to \?\? ""/
  );

  assert.equal(normalizeOrdersDetailActionSupplierName(supplierName), supplierName);
  assert.equal(normalizeOrdersDetailActionSupplierName(` ${supplierName} `), supplierName);
  assert.equal(
    normalizeOrdersDetailActionSupplierName(`Proveedor ${supplierName}`),
    `Proveedor ${supplierName}`
  );
});

test("Unicode padding invents via trim and is soft-nulled for Orders detail action a11y supplier names", () => {
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
  assert.equal(asciiTrimOrdersDetailActionSupplierName(padded), padded);
  assert.equal(canonicalizeOrdersDetailActionSupplierName(padded), null);
  assert.equal(canonicalizeOrdersDetailActionSupplierName(nbspName), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(padded), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(nbspName), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeOrdersDetailActionSupplierName(internalEm), internalEm);
  assert.equal(normalizeOrdersDetailActionSupplierName(internalNbsp), internalNbsp);
  assert.equal(normalizeOrdersDetailActionSupplierName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Orders detail action a11y supplier names", () => {
  assert.equal(normalizeOrdersDetailActionSupplierName(undefined), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(null), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(""), null);
  assert.equal(normalizeOrdersDetailActionSupplierName("   "), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(123 as unknown as string), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(`\u0001${supplierName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeOrdersDetailActionSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeOrdersDetailActionSupplierName(`${supplierName}\u0007`), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(em), null);
});

test("Orders detail action a11y bypass proof: empty and Unicode-only-space names soft-null to localized none", () => {
  // Prior always-pass-name path still interpolated blank-looking supplier into a11y.
  assert.equal(normalizeOrdersDetailActionSupplierName(""), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(em), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(nbsp), null);
  assert.match(
    ordersDetailSource,
    /normalizeOrdersDetailActionSupplierName\(visibleOrder\?\.supplier_name\)\s*\|\|\s*t\("orders\.detail\.action\.supplier\.none"\)/
  );
});

test("Orders detail action a11y supplier-name identity refuses Unicode inventing equality", () => {
  const padded = `${em}${supplierName}${em}`;
  assert.notEqual(asciiTrimOrdersDetailActionSupplierName(padded), padded.trim());
  assert.equal(normalizeOrdersDetailActionSupplierName(padded), null);
  assert.equal(normalizeOrdersDetailActionSupplierName(`\t${supplierName}\n`), supplierName);
});
