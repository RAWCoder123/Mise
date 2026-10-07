import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalSetupScreenSupplierDisplayName,
  isValidSetupScreenSupplierDisplayName,
  isValidSetupScreenSupplierEmail,
  normalizeSetupScreenOptionalEmail,
  normalizeSetupScreenSupplierNameKey,
  setupScreenSupplierNameKeysMatch
} from "../services/domain/setupScreenSupplierIdentity";

const domainSource = readFileSync(
  new URL("../services/domain/setupScreenSupplierIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/(auth)/setup.tsx", import.meta.url),
  "utf8"
);

test("MISE-005KA pins auth setup-screen supplier identity to ASCII C", () => {
  assert.match(domainSource, /MISE-005KA/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(domainSource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(domainSource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    domainSource,
    /asciiCMailboxShape =\s*\n?\s*\/\^\[\^ \\t\\n\\r\\f\\v@\]\+@\[\^ \\t\\n\\r\\f\\v@\]\+\\\.\[\^ \\t\\n\\r\\f\\v@\]\+\$\//
  );

  const nameKeyBody = domainSource.slice(
    domainSource.indexOf("export function normalizeSetupScreenSupplierNameKey("),
    domainSource.indexOf("export function setupScreenSupplierNameKeysMatch(")
  );
  assert.match(nameKeyBody, /asciiCLower\(canonicalSetupScreenSupplierDisplayName\(value\)\)/);
  assert.doesNotMatch(nameKeyBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(nameKeyBody, /\.toLocaleLowerCase\(/);
  assert.doesNotMatch(nameKeyBody, /\.trim\(\)/);
  assert.doesNotMatch(nameKeyBody, /\\s/);

  const emailBody = domainSource.slice(
    domainSource.indexOf("export function normalizeSetupScreenOptionalEmail("),
    domainSource.indexOf("export function isValidSetupScreenSupplierEmail(")
  );
  assert.match(emailBody, /asciiCTrim\(asciiCLower\(value\)\)/);
  assert.match(emailBody, /asciiCControl\.test\(normalized\)/);
  assert.match(emailBody, /asciiCMailboxShape\.test\(normalized\)/);
  assert.doesNotMatch(emailBody, /\.toLocaleLowerCase\(/);
  assert.doesNotMatch(emailBody, /\\s/);

  assert.match(
    screenSource,
    /import \{\s*canonicalSetupScreenSupplierDisplayName,\s*isValidSetupScreenSupplierDisplayName,\s*isValidSetupScreenSupplierEmail,\s*normalizeSetupScreenSupplierNameKey\s*\} from "\.\.\/\.\.\/services\/domain\/setupScreenSupplierIdentity"/
  );
  assert.match(screenSource, /MISE-005KA/);
  assert.match(screenSource, /canonicalSetupScreenSupplierDisplayName\(/);
  assert.match(screenSource, /normalizeSetupScreenSupplierNameKey\(/);
  assert.match(screenSource, /isValidSetupScreenSupplierDisplayName\(/);
  assert.match(screenSource, /isValidSetupScreenSupplierEmail\(/);
  assert.doesNotMatch(screenSource, /function isValidEmail\(/);
  assert.doesNotMatch(
    screenSource.slice(
      screenSource.indexOf("const seenSupplierNames"),
      screenSource.indexOf("for (const [recipeIndex, recipe]")
    ),
    /\.toLocaleLowerCase\(/
  );
});

test("ASCII C fold keeps ordinary setup-screen supplier names and emails stable", () => {
  assert.equal(normalizeSetupScreenSupplierNameKey("Sysco"), "sysco");
  assert.equal(normalizeSetupScreenSupplierNameKey("  Sysco Foods  "), "sysco foods");
  assert.equal(
    canonicalSetupScreenSupplierDisplayName("Sysco\u00a0Foods"),
    "Sysco Foods"
  );
  assert.equal(
    canonicalSetupScreenSupplierDisplayName("Sysco\t\tFoods"),
    "Sysco Foods"
  );
  assert.ok(setupScreenSupplierNameKeysMatch("Sysco", "sysco"));
  assert.ok(isValidSetupScreenSupplierDisplayName("Sysco Foods"));
  assert.equal(normalizeSetupScreenOptionalEmail("Ops@Example.COM"), "ops@example.com");
  assert.ok(isValidSetupScreenSupplierEmail("ops@example.com"));
  assert.equal(normalizeSetupScreenOptionalEmail("   "), null);
  assert.equal(normalizeSetupScreenOptionalEmail("not-an-email"), null);
  assert.equal(normalizeSetupScreenOptionalEmail("a@b"), null);
});

test("ASCII C fold does not invent Kelvin-sign setup-screen supplier identity", () => {
  // Unicode toLocaleLowerCase("en-US") would fold K → k and invent "sysco".
  const kelvinSysco = "\u212aelvin Dairy";
  assert.notEqual(normalizeSetupScreenSupplierNameKey(kelvinSysco), "kelvin dairy");
  assert.notEqual(
    normalizeSetupScreenSupplierNameKey(kelvinSysco),
    normalizeSetupScreenSupplierNameKey("Kelvin Dairy")
  );
  assert.ok(!setupScreenSupplierNameKeysMatch(kelvinSysco, "Kelvin Dairy"));

  // Em-space must not collapse the way Unicode \s would.
  assert.notEqual(
    canonicalSetupScreenSupplierDisplayName("Sysco\u2003Foods"),
    "Sysco Foods"
  );

  // Kelvin in a mailbox local-part must not fold to ASCII k.
  const kelvinMailbox = "\u212aelvin@example.com";
  assert.notEqual(normalizeSetupScreenOptionalEmail(kelvinMailbox), "kelvin@example.com");
  assert.ok(isValidSetupScreenSupplierEmail(kelvinMailbox));
  assert.ok(!isValidSetupScreenSupplierEmail("ops@exam\nple.com"));
  assert.ok(!isValidSetupScreenSupplierEmail("ops@exam\rple.com"));
  assert.ok(!isValidSetupScreenSupplierEmail("ops@exam\x01ple.com"));
  assert.ok(!isValidSetupScreenSupplierEmail("ops@exam\x7fple.com"));
  assert.ok(!isValidSetupScreenSupplierDisplayName("Bad\x00Name"));
  assert.ok(!isValidSetupScreenSupplierDisplayName(""));
});
