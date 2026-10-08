import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiCLowerHostedUuidToken,
  asciiTrimHostedUuidToken,
  canonicalizeHostedUuid,
  requireCanonicalHostedUuid
} from "../services/domain/hostedUuidIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/hostedUuidIdentity.ts", import.meta.url),
  "utf8"
);
const repositorySource = readFileSync(
  new URL("../services/repositories/supabaseRepository.ts", import.meta.url),
  "utf8"
);

const uuid = "abcdef01-2345-4789-ab01-cdef23456789";
const upperUuid = "ABCDEF01-2345-4789-AB01-CDEF23456789";

test("MISE-005KV pins hosted requireHostedUuid identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005KV/);
  assert.match(repositorySource, /MISE-005KV/);

  assert.match(
    identitySource,
    /export function asciiCLowerHostedUuidToken\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(
    identitySource,
    /export function asciiTrimHostedUuidToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const requireBody = repositorySource.slice(
    repositorySource.indexOf("function requireHostedUuid(value: string, label: string)"),
    repositorySource.indexOf("function normalizeHostedSupplier")
  );
  assert.match(requireBody, /requireCanonicalHostedUuid\(value, label\)/);
  assert.doesNotMatch(requireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.trim\(\)/);

  // Do not retarget Edge/outreach UUID tips or miseValidation supplier authority IDs.
  assert.doesNotMatch(repositorySource, /supabase\/functions\/_shared\/uuidIdentity/);
});

test("ASCII C fold keeps ordinary hex UUID case folding stable", () => {
  assert.equal(asciiCLowerHostedUuidToken(upperUuid), uuid);
  assert.equal(canonicalizeHostedUuid(upperUuid), uuid);
  assert.equal(canonicalizeHostedUuid(`  ${upperUuid}  `), uuid);
  assert.equal(requireCanonicalHostedUuid(upperUuid, "restaurant"), uuid);
  assert.equal(requireCanonicalHostedUuid(`  ${uuid}  `, "restaurant"), uuid);
});

test("non-hex Unicode folds stay fail-closed under ASCII C hosted UUID identity", () => {
  // Kelvin folds to ASCII k under Unicode lower; keep the token literal under ASCII C.
  assert.equal("K".toLowerCase(), "k");
  assert.equal("K".toLocaleLowerCase(), "k");

  const forged = `${uuid.slice(0, -1)}K`;
  assert.equal(forged.toLowerCase(), `${uuid.slice(0, -1)}k`);
  assert.equal(asciiCLowerHostedUuidToken(forged), forged);
  assert.equal(canonicalizeHostedUuid(forged), null);
  assert.throws(
    () => requireCanonicalHostedUuid(forged, "restaurant"),
    (error: unknown) =>
      error instanceof Error && error.message === "Invalid restaurant identity."
  );
});

test("ASCII UUID trim ignores NBSP; Unicode trim would invent hosted identity", () => {
  const nbspPadded = `\u00a0${uuid}\u00a0`;
  // Unicode trim invents an exact match against the unpadded UUID.
  assert.equal(nbspPadded.trim(), uuid);
  assert.equal(nbspPadded.trim().toLowerCase(), uuid);
  assert.notEqual(asciiTrimHostedUuidToken(nbspPadded), uuid);
  assert.equal(canonicalizeHostedUuid(nbspPadded), null);
  assert.throws(
    () => requireCanonicalHostedUuid(nbspPadded, "restaurant"),
    (error: unknown) =>
      error instanceof Error && error.message === "Invalid restaurant identity."
  );

  const emSpacePadded = `\u2003${uuid}\u2003`;
  assert.equal(emSpacePadded.trim(), uuid);
  assert.equal(canonicalizeHostedUuid(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalHostedUuid(emSpacePadded, "supplier"),
    (error: unknown) =>
      error instanceof Error && error.message === "Invalid supplier identity."
  );
});
