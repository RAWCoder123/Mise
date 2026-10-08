import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiCLowerUuidToken,
  asciiTrimUuidToken,
  canonicalizeEdgeUuid,
  requireCanonicalEdgeUuid
} from "../supabase/functions/_shared/uuidIdentity.ts";

const uuidIdentitySource = readFileSync(
  new URL("../supabase/functions/_shared/uuidIdentity.ts", import.meta.url),
  "utf8"
);
const miseSource = readFileSync(
  new URL("../supabase/functions/_shared/mise.ts", import.meta.url),
  "utf8"
);

const uuid = "abcdef01-2345-4789-ab01-cdef23456789";
const upperUuid = "ABCDEF01-2345-4789-AB01-CDEF23456789";

test("MISE-005KP pins Edge requireUuid identity to ASCII C", () => {
  assert.match(uuidIdentitySource, /MISE-005KP/);
  assert.match(miseSource, /MISE-005KP/);

  assert.match(
    uuidIdentitySource,
    /export function asciiCLowerUuidToken\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );
  assert.match(
    uuidIdentitySource,
    /export function asciiTrimUuidToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const requireBody = miseSource.slice(
    miseSource.indexOf("export function requireUuid(value: unknown, fieldName: string)"),
    miseSource.indexOf("export function requireIsoDateString")
  );
  assert.match(requireBody, /requireCanonicalEdgeUuid\(value, fieldName\)/);
  assert.doesNotMatch(requireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /requireString\(/);
  assert.doesNotMatch(requireBody, /\.trim\(\)/);

  // Do not retarget outreach-agent's local requireUuid, isCanonicalEmail
  // reject-non-lower, or #706 secret scrubbers from this tip.
  assert.match(miseSource, /safeFunctionMetadata/);
});

test("ASCII C fold keeps ordinary hex UUID case folding stable", () => {
  assert.equal(asciiCLowerUuidToken(upperUuid), uuid);
  assert.equal(canonicalizeEdgeUuid(upperUuid), uuid);
  assert.equal(canonicalizeEdgeUuid(`  ${upperUuid}  `), uuid);
  assert.equal(requireCanonicalEdgeUuid(upperUuid, "restaurantId"), uuid);
  assert.equal(requireCanonicalEdgeUuid(`  ${uuid}  `, "restaurantId"), uuid);
});

test("non-hex Unicode folds stay fail-closed under ASCII C UUID identity", () => {
  // Kelvin folds to ASCII k under Unicode lower, but k is outside [0-9a-f].
  assert.equal("K".toLowerCase(), "k");
  assert.equal("K".toLocaleLowerCase(), "k");

  const forged = `${uuid.slice(0, -1)}K`;
  assert.equal(forged.toLowerCase(), `${uuid.slice(0, -1)}k`);
  assert.equal(asciiCLowerUuidToken(forged), forged);
  assert.equal(canonicalizeEdgeUuid(forged), null);
  assert.throws(
    () => requireCanonicalEdgeUuid(forged, "restaurantId"),
    (error: unknown) =>
      error instanceof Error && /must be a valid UUID/i.test(error.message)
  );
});

test("ASCII UUID trim ignores NBSP; Unicode trim would invent Edge identity", () => {
  const nbspPadded = `\u00a0${uuid}\u00a0`;
  // Unicode trim invents an exact match against the unpadded UUID.
  assert.equal(nbspPadded.trim(), uuid);
  assert.equal(nbspPadded.trim().toLowerCase(), uuid);
  assert.notEqual(asciiTrimUuidToken(nbspPadded), uuid);
  assert.equal(canonicalizeEdgeUuid(nbspPadded), null);
  assert.throws(
    () => requireCanonicalEdgeUuid(nbspPadded, "restaurantId"),
    (error: unknown) =>
      error instanceof Error && /must be a valid UUID/i.test(error.message)
  );

  const emSpacePadded = `\u2003${uuid}\u2003`;
  assert.equal(emSpacePadded.trim(), uuid);
  assert.equal(canonicalizeEdgeUuid(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalEdgeUuid(emSpacePadded, "orderId"),
    (error: unknown) =>
      error instanceof Error && /must be a valid UUID/i.test(error.message)
  );
});
