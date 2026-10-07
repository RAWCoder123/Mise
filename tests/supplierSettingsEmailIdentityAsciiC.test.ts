import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isValidSupplierSettingsRecipientEmail,
  normalizeSupplierSettingsEmailKey,
  normalizeSupplierSettingsRecipientEmail,
  supplierSettingsEmailsMatch
} from "../services/domain/supplierSettingsEmailIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/supplierSettingsEmailIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/suppliers.tsx", import.meta.url),
  "utf8"
);

test("MISE-005JU pins suppliers-settings draft-email identity to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JU/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeSupplierSettingsEmailKey("),
    domainSource.indexOf("export function supplierSettingsEmailsMatch(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(
    screenSource,
    /import \{\s*isValidSupplierSettingsRecipientEmail,\s*normalizeSupplierSettingsRecipientEmail,\s*supplierSettingsEmailsMatch\s*\} from "\.\.\/\.\.\/services\/domain\/supplierSettingsEmailIdentity"/
  );
  assert.match(screenSource, /MISE-005JU/);
  assert.match(screenSource, /supplierSettingsEmailsMatch\(/);
  assert.match(screenSource, /normalizeSupplierSettingsRecipientEmail\(/);
  assert.match(screenSource, /isValidSupplierSettingsRecipientEmail\(/);
  assert.doesNotMatch(
    screenSource,
    /draftEmail\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    screenSource,
    /\(entry\.email \?\? ""\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(screenSource, /function isValidRecipientEmail\(/);
  assert.doesNotMatch(screenSource, /\(draftEmails\[key\] \?\? ""\)\.trim\(\)/);
  assert.doesNotMatch(screenSource, /\/\^\[\^\\s@\]\+/);
});

test("ASCII C fold keeps ordinary suppliers-settings mailboxes stable", () => {
  assert.equal(
    normalizeSupplierSettingsEmailKey("  Orders@Fresh.Example  "),
    "orders@fresh.example"
  );
  assert.equal(
    normalizeSupplierSettingsRecipientEmail("ORDERS@FRESH.EXAMPLE"),
    "orders@fresh.example"
  );
  assert.equal(
    supplierSettingsEmailsMatch("Orders@Fresh.Example", "  orders@fresh.example  "),
    true
  );
  assert.equal(isValidSupplierSettingsRecipientEmail("  Orders@Fresh.Example  "), true);
  assert.equal(isValidSupplierSettingsRecipientEmail("not-an-email"), false);
  assert.equal(isValidSupplierSettingsRecipientEmail("a@b"), false);
});

test("ASCII C fold does not invent Kelvin-sign suppliers-settings identity", () => {
  // Unicode toLowerCase would fold K → k and invent orders@fresh.example.
  assert.equal(
    normalizeSupplierSettingsEmailKey("Krders@Fresh.Example"),
    "Krders@fresh.example"
  );
  assert.notEqual(
    normalizeSupplierSettingsEmailKey("Krders@Fresh.Example"),
    normalizeSupplierSettingsEmailKey("Orders@Fresh.Example")
  );
  assert.equal(
    supplierSettingsEmailsMatch("Krders@Fresh.Example", "orders@fresh.example"),
    false
  );

  assert.equal(
    normalizeSupplierSettingsEmailKey("orders@Kresh.example"),
    "orders@Kresh.example"
  );
  assert.notEqual(
    normalizeSupplierSettingsEmailKey("orders@Kresh.example"),
    normalizeSupplierSettingsEmailKey("orders@kresh.example")
  );

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode trim target.
  assert.equal(
    normalizeSupplierSettingsEmailKey("\u00a0orders@fresh.example\u00a0"),
    "\u00a0orders@fresh.example\u00a0"
  );
  assert.notEqual(
    normalizeSupplierSettingsEmailKey("\u00a0orders@fresh.example\u00a0"),
    normalizeSupplierSettingsEmailKey("orders@fresh.example")
  );

  // Middle NBSP is outside C-locale [[:space:]]; preserve rather than reject via `\s`.
  assert.equal(
    isValidSupplierSettingsRecipientEmail("orders@exam\u00a0ple.com"),
    true
  );
  assert.equal(
    normalizeSupplierSettingsRecipientEmail("orders@exam\u00a0ple.com"),
    "orders@exam\u00a0ple.com"
  );
});
