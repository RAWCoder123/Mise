import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiCLowerSupplierAuthorityUuidToken,
  asciiTrimSupplierAuthorityUuidToken,
  canonicalizeSupplierAuthorityUuid,
  requireCanonicalSupplierAuthorityUuid
} from "../services/domain/supplierAuthorityIdentity";
import { requireSupplierAuthorityId } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/supplierAuthorityIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const uuid = "abcdef01-2345-4789-ab01-cdef23456789";
const upperUuid = "ABCDEF01-2345-4789-AB01-CDEF23456789";

test("MISE-005KW pins requireSupplierAuthorityId identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005KW/);
  assert.match(validationSource, /MISE-005KW/);

  assert.match(
    identitySource,
    /export function asciiCLowerSupplierAuthorityUuidToken\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(
    identitySource,
    /export function asciiTrimSupplierAuthorityUuidToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const requireBody = validationSource.slice(
    validationSource.indexOf(
      "export function requireSupplierAuthorityId(value: unknown, label = \"supplier\")"
    ),
    validationSource.indexOf("export function requireSupplierDisplayName")
  );
  assert.match(requireBody, /requireCanonicalSupplierAuthorityUuid\(value, label\)/);
  assert.doesNotMatch(requireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.trim\(\)/);

  // Do not retarget hosted / Edge / outreach UUID tips.
  assert.doesNotMatch(identitySource, /hostedUuidIdentity/);
  assert.doesNotMatch(identitySource, /supabase\/functions\/_shared\/uuidIdentity/);
  assert.doesNotMatch(validationSource, /hostedUuidIdentity/);
});

test("ASCII C fold keeps ordinary hex supplier-authority UUID case folding stable", () => {
  assert.equal(asciiCLowerSupplierAuthorityUuidToken(upperUuid), uuid);
  assert.equal(canonicalizeSupplierAuthorityUuid(upperUuid), uuid);
  assert.equal(canonicalizeSupplierAuthorityUuid(`  ${upperUuid}  `), uuid);
  assert.equal(requireCanonicalSupplierAuthorityUuid(upperUuid), uuid);
  assert.equal(requireCanonicalSupplierAuthorityUuid(`  ${uuid}  `, "restaurant"), uuid);
  assert.equal(requireSupplierAuthorityId(upperUuid), uuid);
  assert.equal(requireSupplierAuthorityId(`\t${uuid}\n`, "restaurant"), uuid);
});

test("non-hex Unicode folds stay fail-closed under ASCII C supplier-authority identity", () => {
  // Kelvin folds to ASCII k under Unicode lower; keep the token literal under ASCII C.
  assert.equal("K".toLowerCase(), "k");
  assert.equal("K".toLocaleLowerCase(), "k");

  const forged = `${uuid.slice(0, -1)}K`;
  assert.equal(asciiCLowerSupplierAuthorityUuidToken(forged), forged);
  assert.equal(canonicalizeSupplierAuthorityUuid(forged), null);
  assert.throws(
    () => requireCanonicalSupplierAuthorityUuid(forged, "restaurant"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant identity."
  );
  assert.throws(
    () => requireSupplierAuthorityId(forged),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier identity."
  );
});

test("ASCII UUID trim ignores NBSP; Unicode trim would invent supplier-authority identity", () => {
  const nbspPadded = `\u00a0${uuid}\u00a0`;
  // Unicode trim invents an exact match against the unpadded UUID.
  assert.equal(nbspPadded.trim(), uuid);
  assert.notEqual(asciiTrimSupplierAuthorityUuidToken(nbspPadded), uuid);
  assert.equal(canonicalizeSupplierAuthorityUuid(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSupplierAuthorityUuid(nbspPadded, "restaurant"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant identity."
  );
  assert.throws(
    () => requireSupplierAuthorityId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing supplier identity."
  );

  const emSpacePadded = `\u2003${uuid}\u2003`;
  assert.equal(emSpacePadded.trim(), uuid);
  assert.equal(canonicalizeSupplierAuthorityUuid(emSpacePadded), null);
  assert.throws(
    () => requireSupplierAuthorityId(emSpacePadded, "inventory item"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing inventory item identity."
  );
});
