import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isValidAccountEmail,
  normalizeAccountEmail,
  validateSignUpInput
} from "../services/domain/accountAuth";

const domainSource = readFileSync(
  new URL("../services/domain/accountAuth.ts", import.meta.url),
  "utf8"
);

test("MISE-005KS pins accountAuth mailbox identity to ASCII C", () => {
  assert.match(domainSource, /MISE-005KS/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(
    domainSource,
    /function asciiCTrim\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeAccountEmail("),
    domainSource.indexOf("export function isValidAccountEmail(")
  );
  assert.match(normalizeBody, /asciiCTrim\(asciiCLower\(value\)\)/);
  assert.match(normalizeBody, /asciiCControl\.test\(normalized\)/);
  assert.match(normalizeBody, /asciiCMailboxShape\.test\(normalized\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  const validateBody = domainSource.slice(
    domainSource.indexOf("export function validateSignUpInput("),
    domainSource.indexOf("interface SignUpResultShape")
  );
  assert.match(validateBody, /asciiCTrim\(email\)/);
  assert.doesNotMatch(validateBody, /email\.trim\(\)/);
});

test("ASCII C fold keeps ordinary account mailboxes stable", () => {
  assert.equal(normalizeAccountEmail("  Chef@Bistro.co  "), "chef@bistro.co");
  assert.equal(normalizeAccountEmail("Ops@Example.COM"), "ops@example.com");
  assert.ok(isValidAccountEmail("chef@bistro.co"));
  assert.ok(isValidAccountEmail("  Owner@Restaurant.com  "));
  assert.ok(!isValidAccountEmail("not-an-email"));
  assert.ok(!isValidAccountEmail("a@b"));
  assert.ok(!isValidAccountEmail(`${"a".repeat(250)}@x.com`));
  assert.equal(validateSignUpInput("  owner@restaurant.com  ", "123456", "123456"), null);
});

test("ASCII C fold does not invent Kelvin-sign mailbox identity", () => {
  // Unicode toLowerCase would fold K → k and invent chef@bistro.co.
  assert.equal(normalizeAccountEmail("Khef@Bistro.co"), "Khef@bistro.co");
  assert.notEqual(normalizeAccountEmail("Khef@Bistro.co"), "chef@bistro.co");

  // Kelvin in the domain must not become a lookalike ASCII host.
  assert.equal(normalizeAccountEmail("chef@Kistro.co"), "chef@Kistro.co");
  assert.notEqual(normalizeAccountEmail("chef@Kistro.co"), "chef@kistro.co");
});

test("ASCII C mailbox shape rejects controls; NBSP is not ASCII space", () => {
  assert.equal(normalizeAccountEmail("ops@exam\nple.com"), null);
  assert.equal(normalizeAccountEmail("ops@exam\rple.com"), null);
  assert.equal(normalizeAccountEmail("ops@exam\x01ple.com"), null);
  assert.equal(normalizeAccountEmail("ops@exam\x7fple.com"), null);
  // NBSP is outside C-locale [[:space:]]; preserve it rather than treating it
  // as a Unicode `\s` break the way the pre-pin client did.
  assert.equal(
    normalizeAccountEmail("ops@exam\u00a0ple.com"),
    "ops@exam\u00a0ple.com"
  );

  // Unicode trim would invent a clean mailbox from NBSP padding; ASCII C trim
  // preserves end NBSP so padded and unpadded stay distinct identities.
  assert.equal(
    normalizeAccountEmail("\u00a0owner@restaurant.com\u00a0"),
    "\u00a0owner@restaurant.com\u00a0"
  );
  assert.notEqual(
    normalizeAccountEmail("\u00a0owner@restaurant.com\u00a0"),
    "owner@restaurant.com"
  );

  // NBSP-only is not "missing" under ASCII C trim — it fails shape closed.
  assert.equal(validateSignUpInput("\u00a0", "123456", "123456"), "email_invalid");
});
