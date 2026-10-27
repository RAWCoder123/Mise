import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierSendSubject,
  buildSupplierSendSubject,
  canonicalizeSupplierSendSubject,
  normalizeSupplierSendSubject
} from "../services/domain/supplierSendSubjectIdentity";

const sendContentSource = readFileSync(
  new URL("../services/domain/supplierSendContent.ts", import.meta.url),
  "utf8"
);
const identitySource = readFileSync(
  new URL("../services/domain/supplierSendSubjectIdentity.ts", import.meta.url),
  "utf8"
);

test("MISE-005SA pins demo supplier-send subject identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005SA/);
  assert.match(sendContentSource, /MISE-005SA/);
  assert.match(sendContentSource, /buildSupplierSendSubject/);
  assert.match(
    sendContentSource,
    /function normalizedSubject\(restaurantName: string, supplierName: string\) \{\s*return buildSupplierSendSubject\(restaurantName, supplierName\);\s*\}/
  );

  assert.match(
    identitySource,
    /export function normalizeSupplierSendSubject\([\s\S]*?canonicalizeSupplierSendSubject\(value\)/
  );
  assert.match(
    identitySource,
    /export function buildSupplierSendSubject\([\s\S]*?normalizeSupplierSendSubject\(subject\)/
  );
  // Prior inventing sink was CR/LF collapse then Unicode `.trim()` in
  // supplierSendContent — that chain must not return.
  assert.doesNotMatch(
    sendContentSource,
    /\$\{restaurantName\} order for \$\{supplierName\}[\s\S]*?\.trim\(\)/
  );

  // Leave open #708 mailbox path alone on main.
  assert.match(sendContentSource, /function normalizedEmail\(/);
  assert.doesNotMatch(sendContentSource, /normalizeSupplierSendEmail\(/);
});

test("ASCII whitespace still trims clean before durable supplier-send subject", () => {
  // Prior contract: end ASCII spaces on names become internal spaces in the
  // constructed subject, then only the subject's ends are trimmed.
  assert.equal(
    buildSupplierSendSubject("  Harbor Kitchen  ", "Acme Foods"),
    "Harbor Kitchen   order for Acme Foods"
  );
  assert.equal(
    buildSupplierSendSubject("Harbor Kitchen", "Acme Foods"),
    "Harbor Kitchen order for Acme Foods"
  );
  assert.equal(
    normalizeSupplierSendSubject("  Harbor Kitchen order for Acme Foods  "),
    "Harbor Kitchen order for Acme Foods"
  );
  assert.equal(
    canonicalizeSupplierSendSubject("\tHarbor Kitchen order for Acme Foods\n"),
    "Harbor Kitchen order for Acme Foods"
  );
  assert.equal(asciiTrimSupplierSendSubject("  subject  "), "subject");
  // Empty display names still build the prior ASCII template subject.
  assert.equal(buildSupplierSendSubject("", ""), "order for");
});

test("Unicode-padded supplier-send subjects fail closed instead of inventing", () => {
  // Prior Unicode trim invented a clean durable subject / fingerprint identity.
  assert.equal(
    "\u2003Harbor Kitchen order for Acme Foods\u2003".trim(),
    "Harbor Kitchen order for Acme Foods"
  );
  assert.equal(
    normalizeSupplierSendSubject("\u2003Harbor Kitchen order for Acme Foods\u2003"),
    null
  );
  assert.equal(
    buildSupplierSendSubject("\u2003Harbor Kitchen\u2003", "Acme Foods"),
    null
  );
  assert.equal(
    buildSupplierSendSubject("Harbor Kitchen", "\u2003Acme Foods\u2003"),
    null
  );
  // Em-space-only names: prior `.trim()` invented "order for"; ASCII C fails closed.
  assert.equal("\u2003 order for \u2003".trim(), "order for");
  assert.equal(buildSupplierSendSubject("\u2003", "\u2003"), null);
  // Internal NBSP is not end-padding; do not invent equality with a space.
  assert.equal(
    normalizeSupplierSendSubject("Harbor\u00a0Kitchen order for Acme"),
    "Harbor\u00a0Kitchen order for Acme"
  );
  assert.notEqual(
    normalizeSupplierSendSubject("Harbor\u00a0Kitchen order for Acme"),
    "Harbor Kitchen order for Acme"
  );
  assert.equal(normalizeSupplierSendSubject("subject\u0000"), null);
});

test("soft empty / Unicode-only space stay null for send_subject_invalid", () => {
  assert.equal(normalizeSupplierSendSubject(""), null);
  assert.equal(normalizeSupplierSendSubject("   "), null);
  assert.equal(normalizeSupplierSendSubject("\u2003"), null);
  assert.equal(normalizeSupplierSendSubject("\u00a0"), null);
  assert.equal(normalizeSupplierSendSubject(null), null);
  assert.equal(normalizeSupplierSendSubject(undefined), null);
});
