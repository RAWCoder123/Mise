import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeSupplierSendEmail } from "../services/domain/supplierSendContent";

const sendContentSource = readFileSync(
  new URL("../services/domain/supplierSendContent.ts", import.meta.url),
  "utf8"
);

test("MISE-005KM pins demo supplier-send mailbox identity to ASCII C case fold", () => {
  assert.match(sendContentSource, /MISE-005KM/);
  assert.match(
    sendContentSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = sendContentSource.slice(
    sendContentSource.indexOf("export function normalizeSupplierSendEmail("),
    sendContentSource.indexOf("function normalizedSubject(")
  );

  assert.match(normalizeBody, /asciiCTrim\(asciiCLower\(value\)\)/);
  assert.match(normalizeBody, /ASCII_C_MAILBOX_SHAPE\.test\(normalized\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(
    sendContentSource,
    /normalizeSupplierSendEmail\(input\.emailConnection\.sender_email\)/
  );
  assert.match(
    sendContentSource,
    /normalizeSupplierSendEmail\(matchingRecipients\[0\]\?\.email\)/
  );
  assert.doesNotMatch(sendContentSource, /function normalizedEmail\(/);
  assert.doesNotMatch(sendContentSource, /EMAIL_PATTERN/);
});

test("ASCII C fold keeps ordinary supplier-send mailboxes stable", () => {
  assert.equal(
    normalizeSupplierSendEmail("  Orders@Fresh.Example  "),
    "orders@fresh.example"
  );
  assert.equal(normalizeSupplierSendEmail("SENDER@MISE.EXAMPLE"), "sender@mise.example");
  assert.equal(normalizeSupplierSendEmail("not-an-email"), null);
  assert.equal(normalizeSupplierSendEmail("a@b"), null);
  assert.equal(normalizeSupplierSendEmail(""), null);
  assert.equal(normalizeSupplierSendEmail(null), null);
  assert.equal(normalizeSupplierSendEmail(undefined), null);
});

test("ASCII C fold does not invent Kelvin-sign supplier-send mailbox identity", () => {
  // Unicode toLowerCase would fold K → k and invent token@mise.example.
  assert.equal(normalizeSupplierSendEmail("toKen@Mise.Example"), "toKen@mise.example");
  assert.notEqual(
    normalizeSupplierSendEmail("toKen@Mise.Example"),
    "token@mise.example"
  );
  assert.equal("toKen@Mise.Example".toLowerCase(), "token@mise.example");

  assert.equal(
    normalizeSupplierSendEmail("orders@Kresh.example"),
    "orders@Kresh.example"
  );
  assert.notEqual(
    normalizeSupplierSendEmail("orders@Kresh.example"),
    "orders@kresh.example"
  );
  assert.equal("orders@Kresh.example".toLowerCase(), "orders@kresh.example");
});

test("ASCII C mailbox shape rejects controls; NBSP is not ASCII space", () => {
  assert.equal(normalizeSupplierSendEmail("orders@exam\nple.com"), null);
  assert.equal(normalizeSupplierSendEmail("orders@exam\x01ple.com"), null);

  // NBSP-only padding is outside ASCII whitespace; do not treat it as a trim break.
  assert.equal(
    normalizeSupplierSendEmail("\u00a0orders@fresh.example\u00a0"),
    "\u00a0orders@fresh.example\u00a0"
  );
  assert.notEqual(
    normalizeSupplierSendEmail("\u00a0orders@fresh.example\u00a0"),
    "orders@fresh.example"
  );
  assert.equal("\u00a0orders@fresh.example\u00a0".trim().toLowerCase(), "orders@fresh.example");
});
