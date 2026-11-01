import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersDetailTitleSupplierName,
  canonicalizeOrdersDetailTitleSupplierName,
  normalizeOrdersDetailTitleSupplierName
} from "../services/domain/ordersDetailTitleSupplierNameIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersDetailTitleSupplierNameIdentity.ts", import.meta.url),
  "utf8"
);
const ordersUiSource = readFileSync(
  new URL("../app/orders/[id].tsx", import.meta.url),
  "utf8"
);

const supplierName = "Acme Foods";
const accentedSupplierName = "Café Luna Produce";
const FALLBACK = "Supplier order";

test("MISE-005VH pins Orders detail Screen title supplier_name to ASCII C", () => {
  assert.match(identitySource, /MISE-005VH/);
  assert.match(ordersUiSource, /MISE-005VH/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersDetailTitleSupplierName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimOrdersDetailTitleSupplierName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    ordersUiSource,
    /normalizeOrdersDetailTitleSupplierName\(visibleOrder\?\.supplier_name\)\s*\|\|\s*t\("orders\.detail\.title"\)/
  );
  assert.doesNotMatch(
    ordersUiSource,
    /visibleOrder\?\.supplier_name \?\? t\("orders\.detail\.title"\)/
  );

  // Leave sibling tips / modules alone.
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewHeaderIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailEmailReviewBodyIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*ordersDetailNoteNoneIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*supplierSendSubjectIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationSettingsAccountEmailLabelIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*outreachWebhookFromEmailIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationInventoryDetailItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationWasteItemNameIdentity/);
  assert.doesNotMatch(identitySource, /from ["'].*presentationGmailSenderEmailIdentity/);

  // Do not rewrite other supplier_name interpolations on this screen.
  assert.match(
    ordersUiSource,
    /supplier: visibleOrder\.supplier_name/
  );
  assert.match(
    ordersUiSource,
    /t\("orders\.detail\.action\.simulateAccessibility", \{\s*supplier: visibleOrder\.supplier_name\s*\}\)/
  );
  // Leave email-review From/To/Subject and body rows on their own tips.
  assert.doesNotMatch(
    ordersUiSource,
    /normalizeOrdersDetailTitleSupplierName\(visibleEmailPayload/
  );
});

test("ASCII C title prep keeps ordinary supplier_name display stable", () => {
  assert.equal(asciiTrimOrdersDetailTitleSupplierName(`  ${supplierName}  `), supplierName);
  assert.equal(asciiTrimOrdersDetailTitleSupplierName(`\t${supplierName}\n`), supplierName);
  assert.equal(canonicalizeOrdersDetailTitleSupplierName(`  ${supplierName}  `), supplierName);
  assert.equal(normalizeOrdersDetailTitleSupplierName(`  ${supplierName}  `), supplierName);
  assert.equal(normalizeOrdersDetailTitleSupplierName(accentedSupplierName), accentedSupplierName);
});

test("Unicode-only space and empty string bypass orders.detail.title via ?? until ASCII C soft-null restores it", () => {
  const emOnly = "\u2003";
  const nbspOnly = "\u00a0";
  const paddedSpaces = "   ";
  const empty = "";

  // Prior `??` bypass proofs (weaker than `||`, but still skips title fallback).
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeOrdersDetailTitleSupplierName(emOnly), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(emOnly) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailTitleSupplierName(nbspOnly), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(paddedSpaces), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(empty), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(null), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(undefined), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(null) || FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean Orders detail title supplier_name display", () => {
  const emName = `\u2003${supplierName}\u2003`;
  const nbspName = `\u00a0${supplierName}\u00a0`;

  // Inventing proof on Unicode trim.
  assert.equal(emName.trim(), supplierName);
  assert.equal(nbspName.trim(), supplierName);

  // Name tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimOrdersDetailTitleSupplierName(emName), emName);
  assert.equal(asciiTrimOrdersDetailTitleSupplierName(nbspName), nbspName);

  // Soft-null refuses to invent clean supplier_name Screen title display.
  assert.equal(canonicalizeOrdersDetailTitleSupplierName(emName), null);
  assert.equal(canonicalizeOrdersDetailTitleSupplierName(nbspName), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(emName), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(nbspName), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(emName) || FALLBACK, FALLBACK);
  assert.equal(normalizeOrdersDetailTitleSupplierName(nbspName) || FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for Orders detail title supplier_name display", () => {
  assert.equal(normalizeOrdersDetailTitleSupplierName(`${supplierName}\u0000`), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(`\u0007${supplierName}`), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(`${supplierName}\u007f`), null);
  // Single-line titles reject embedded LF/CR (unlike multiline note/body tips).
  assert.equal(normalizeOrdersDetailTitleSupplierName(`${supplierName}\nnext`), null);
  assert.equal(normalizeOrdersDetailTitleSupplierName(`${supplierName}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeOrdersDetailTitleSupplierName(`${supplierName}\t`), supplierName);
  assert.equal(normalizeOrdersDetailTitleSupplierName("Acme Foods"), supplierName);
});
