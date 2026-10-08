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
const outreachSource = readFileSync(
  new URL("../supabase/functions/outreach-agent/index.ts", import.meta.url),
  "utf8"
);
const miseSource = readFileSync(
  new URL("../supabase/functions/_shared/mise.ts", import.meta.url),
  "utf8"
);

const uuid = "abcdef01-2345-4789-ab01-cdef23456789";
const upperUuid = "ABCDEF01-2345-4789-AB01-CDEF23456789";

test("MISE-005KQ pins outreach-agent local requireUuid to ASCII C", () => {
  assert.match(uuidIdentitySource, /MISE-005KP/);
  assert.match(outreachSource, /MISE-005KQ/);
  assert.match(outreachSource, /requireCanonicalEdgeUuid/);

  const requireBody = outreachSource.slice(
    outreachSource.indexOf("function requireUuid(value: unknown, fieldName: string)"),
    outreachSource.indexOf("function requireUuidArray")
  );
  assert.match(requireBody, /requireCanonicalEdgeUuid\(value, fieldName\)/);
  assert.doesNotMatch(requireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /requireString\(/);
  assert.doesNotMatch(requireBody, /\.trim\(\)/);

  // Do not retarget shared mise.ts requireUuid from this tip (MISE-005KP).
  const miseRequireBody = miseSource.slice(
    miseSource.indexOf("export function requireUuid(value: unknown, fieldName: string)"),
    miseSource.indexOf("export function requireIsoDateString")
  );
  assert.match(miseRequireBody, /requireString\(/);
  assert.match(miseRequireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(miseRequireBody, /requireCanonicalEdgeUuid/);
});

test("ASCII C fold keeps ordinary hex UUID case folding stable for outreach", () => {
  assert.equal(asciiCLowerUuidToken(upperUuid), uuid);
  assert.equal(canonicalizeEdgeUuid(upperUuid), uuid);
  assert.equal(canonicalizeEdgeUuid(`  ${upperUuid}  `), uuid);
  assert.equal(requireCanonicalEdgeUuid(upperUuid, "campaignId"), uuid);
  assert.equal(requireCanonicalEdgeUuid(`  ${uuid}  `, "leadId"), uuid);
});

test("non-hex Unicode folds stay fail-closed under outreach UUID identity", () => {
  assert.equal("K".toLowerCase(), "k");
  assert.equal("K".toLocaleLowerCase(), "k");

  const forged = `${uuid.slice(0, -1)}K`;
  assert.equal(forged.toLowerCase(), `${uuid.slice(0, -1)}k`);
  assert.equal(asciiCLowerUuidToken(forged), forged);
  assert.equal(canonicalizeEdgeUuid(forged), null);
  assert.throws(
    () => requireCanonicalEdgeUuid(forged, "campaignId"),
    (error: unknown) =>
      error instanceof Error && /must be a valid UUID/i.test(error.message)
  );
});

test("ASCII UUID trim ignores NBSP; Unicode trim would invent outreach identity", () => {
  const nbspPadded = `\u00a0${uuid}\u00a0`;
  assert.equal(nbspPadded.trim(), uuid);
  assert.equal(nbspPadded.trim().toLowerCase(), uuid);
  assert.notEqual(asciiTrimUuidToken(nbspPadded), uuid);
  assert.equal(canonicalizeEdgeUuid(nbspPadded), null);
  assert.throws(
    () => requireCanonicalEdgeUuid(nbspPadded, "campaignId"),
    (error: unknown) =>
      error instanceof Error && /must be a valid UUID/i.test(error.message)
  );

  const emSpacePadded = `\u2003${uuid}\u2003`;
  assert.equal(emSpacePadded.trim(), uuid);
  assert.equal(canonicalizeEdgeUuid(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalEdgeUuid(emSpacePadded, "messageIds"),
    (error: unknown) =>
      error instanceof Error && /must be a valid UUID/i.test(error.message)
  );
});
