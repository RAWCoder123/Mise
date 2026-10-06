import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizeSetupOptionalEmail,
  normalizeSetupSupplierNameKey,
  setupSupplierNameKeysMatch
} from "../services/application/setup";

const applicationSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

test("MISE-005JK pins setup supplier-name and optional email normalize to ASCII C", () => {
  assert.match(applicationSource, /MISE-005JK/);
  assert.match(
    applicationSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const supplierNameBody = applicationSource.slice(
    applicationSource.indexOf("export function normalizeSetupSupplierNameKey("),
    applicationSource.indexOf("export function setupSupplierNameKeysMatch(")
  );
  assert.match(supplierNameBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(supplierNameBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(supplierNameBody, /\.toLocaleLowerCase\(/);
  assert.doesNotMatch(supplierNameBody, /\.trim\(\)/);

  const emailBody = applicationSource.slice(
    applicationSource.indexOf("export function normalizeSetupOptionalEmail("),
    applicationSource.indexOf("export interface SaveRestaurantSetupInput")
  );
  assert.match(emailBody, /asciiCTrim\(asciiCLower\(value\)\)/);
  assert.match(emailBody, /asciiCControl\.test\(normalized\)/);
  assert.match(emailBody, /asciiCMailboxShape\.test\(normalized\)/);
  assert.doesNotMatch(emailBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(emailBody, /\.toLocaleLowerCase\(/);
  assert.doesNotMatch(emailBody, /\.trim\(\)/);
  assert.doesNotMatch(emailBody, /\\s/);

  assert.match(
    applicationSource,
    /const normalizedName = normalizeSetupSupplierNameKey\(displayName\);/
  );
  assert.match(
    applicationSource,
    /email: normalizeSetupOptionalEmail\(supplier\.email\)/
  );
  assert.doesNotMatch(applicationSource, /function normalizeOptionalEmail\(/);

  const validateBody = applicationSource.slice(
    applicationSource.indexOf("function validateSetupInput("),
    applicationSource.indexOf("function assertBoundedSetupNumber(")
  );
  assert.doesNotMatch(validateBody, /\.toLocaleLowerCase\(/);
  assert.doesNotMatch(validateBody, /\.toLowerCase\(\)/);
  assert.match(validateBody, /normalizeSetupSupplierNameKey\(displayName\)/);
  assert.match(validateBody, /normalizeSetupOptionalEmail\(supplier\.email\)/);
});

test("ASCII C fold keeps ordinary setup supplier names and emails stable", () => {
  assert.equal(normalizeSetupSupplierNameKey("  Sysco Foods  "), "sysco foods");
  assert.equal(normalizeSetupSupplierNameKey("SYSCO FOODS"), "sysco foods");
  assert.equal(
    normalizeSetupSupplierNameKey("Sysco Foods"),
    normalizeSetupSupplierNameKey("sysco foods")
  );
  assert.equal(setupSupplierNameKeysMatch("Sysco", "sysco"), true);

  assert.equal(normalizeSetupOptionalEmail("  Orders@Sysco.com  "), "orders@sysco.com");
  assert.equal(normalizeSetupOptionalEmail("OPS@Example.COM"), "ops@example.com");
  assert.equal(normalizeSetupOptionalEmail("   "), null);
  assert.equal(normalizeSetupOptionalEmail(""), null);
  assert.throws(() => normalizeSetupOptionalEmail("not-an-email"), /valid supplier email/);
  assert.throws(() => normalizeSetupOptionalEmail("a@b"), /valid supplier email/);
});

test("ASCII C fold does not invent Kelvin-sign setup supplier identity", () => {
  // Unicode toLocaleLowerCase("en-US") would fold K → k and invent "sysco".
  assert.equal(normalizeSetupSupplierNameKey("Kysco"), "Kysco");
  assert.notEqual(
    normalizeSetupSupplierNameKey("Kysco"),
    normalizeSetupSupplierNameKey("Sysco")
  );
  assert.equal(setupSupplierNameKeysMatch("Kysco", "Sysco"), false);

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode `\s` break.
  assert.equal(
    normalizeSetupSupplierNameKey("Sysco\u00a0Foods"),
    "sysco\u00a0foods"
  );
  assert.notEqual(
    normalizeSetupSupplierNameKey("Sysco\u00a0Foods"),
    normalizeSetupSupplierNameKey("Sysco Foods")
  );

  // Unicode toLowerCase would fold K → k and invent orders@sysco.com.
  assert.equal(normalizeSetupOptionalEmail("Krders@Sysco.com"), "Krders@sysco.com");
  assert.notEqual(normalizeSetupOptionalEmail("Krders@Sysco.com"), "orders@sysco.com");
  assert.equal(normalizeSetupOptionalEmail("orders@Kysco.com"), "orders@Kysco.com");
  assert.notEqual(normalizeSetupOptionalEmail("orders@Kysco.com"), "orders@sysco.com");
});

test("ASCII C mailbox shape rejects controls; NBSP is not ASCII space", () => {
  assert.throws(() => normalizeSetupOptionalEmail("ops@exam\nple.com"), /valid supplier email/);
  assert.throws(() => normalizeSetupOptionalEmail("ops@exam\rple.com"), /valid supplier email/);
  assert.throws(() => normalizeSetupOptionalEmail("ops@exam\x01ple.com"), /valid supplier email/);
  assert.throws(() => normalizeSetupOptionalEmail("ops@exam\x7fple.com"), /valid supplier email/);
  // NBSP is outside C-locale [[:space:]]; preserve it rather than treating it
  // as a Unicode `\s` break the way the pre-pin client did.
  assert.equal(
    normalizeSetupOptionalEmail("ops@exam\u00a0ple.com"),
    "ops@exam\u00a0ple.com"
  );
});
