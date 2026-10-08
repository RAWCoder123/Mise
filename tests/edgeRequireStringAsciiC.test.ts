import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimEdgeString,
  requireCanonicalEdgeEnum,
  requireCanonicalEdgeIsoDateString,
  requireCanonicalEdgeString
} from "../supabase/functions/_shared/stringIdentity.ts";

const stringIdentitySource = readFileSync(
  new URL("../supabase/functions/_shared/stringIdentity.ts", import.meta.url),
  "utf8"
);
const miseSource = readFileSync(
  new URL("../supabase/functions/_shared/mise.ts", import.meta.url),
  "utf8"
);

const DELETE_CONFIRMATION = "delete_my_account" as const;
const ISO_BOUND = "2026-10-08T00:00:00.000Z";

test("MISE-005KT pins Edge requireString identity to ASCII C", () => {
  assert.match(stringIdentitySource, /MISE-005KT/);
  assert.match(miseSource, /MISE-005KT/);

  assert.match(
    stringIdentitySource,
    /export function asciiTrimEdgeString\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const requireStringBody = miseSource.slice(
    miseSource.indexOf("export function requireString(value: unknown, fieldName: string)"),
    miseSource.indexOf("export function requireUuid(value: unknown, fieldName: string)")
  );
  assert.match(requireStringBody, /requireCanonicalEdgeString\(value, fieldName\)/);
  assert.doesNotMatch(requireStringBody, /\.trim\(\)/);
  assert.doesNotMatch(requireStringBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireStringBody, /\.toLocaleLowerCase\(\)/);

  const requireEnumBody = miseSource.slice(
    miseSource.indexOf("export function requireEnum<TValue extends string>("),
    miseSource.indexOf("export function safeFunctionMetadata")
  );
  assert.match(requireEnumBody, /requireCanonicalEdgeEnum\(value, fieldName, allowedValues\)/);
  assert.doesNotMatch(requireEnumBody, /\.trim\(\)/);

  const requireIsoBody = miseSource.slice(
    miseSource.indexOf("export function requireIsoDateString(value: unknown, fieldName: string)"),
    miseSource.indexOf("export function requireEnum<TValue extends string>(")
  );
  assert.match(requireIsoBody, /requireCanonicalEdgeIsoDateString\(value, fieldName\)/);
  assert.doesNotMatch(requireIsoBody, /\.trim\(\)/);

  // Do not retarget requireUuid (MISE-005KP), outreach-agent's local
  // requireString, isCanonicalEmail reject-non-lower, or #706 secret scrubbers.
  assert.match(miseSource, /export function requireUuid/);
  assert.match(miseSource, /safeFunctionMetadata/);
});

test("ASCII trim keeps ordinary Edge string and enum identity stable", () => {
  assert.equal(asciiTrimEdgeString(`  ${DELETE_CONFIRMATION}  `), DELETE_CONFIRMATION);
  assert.equal(
    requireCanonicalEdgeString(`  ${DELETE_CONFIRMATION}  `, "confirmation"),
    DELETE_CONFIRMATION
  );
  assert.equal(
    requireCanonicalEdgeEnum(`  ${DELETE_CONFIRMATION}  `, "confirmation", [
      DELETE_CONFIRMATION
    ] as const),
    DELETE_CONFIRMATION
  );
  assert.equal(
    requireCanonicalEdgeIsoDateString(`  ${ISO_BOUND}  `, "from"),
    ISO_BOUND
  );
});

test("ASCII string trim ignores NBSP; Unicode trim would invent Edge identity", () => {
  const nbspPaddedConfirmation = `\u00a0${DELETE_CONFIRMATION}\u00a0`;
  // Unicode trim invents an exact match against the destructive confirmation.
  assert.equal(nbspPaddedConfirmation.trim(), DELETE_CONFIRMATION);
  assert.notEqual(asciiTrimEdgeString(nbspPaddedConfirmation), DELETE_CONFIRMATION);
  assert.equal(requireCanonicalEdgeString(nbspPaddedConfirmation, "confirmation"), nbspPaddedConfirmation);
  assert.throws(
    () =>
      requireCanonicalEdgeEnum(nbspPaddedConfirmation, "confirmation", [
        DELETE_CONFIRMATION
      ] as const),
    (error: unknown) =>
      error instanceof Error && /is not supported/i.test(error.message)
  );

  const emSpacePaddedAction = `\u2003sync\u2003`;
  assert.equal(emSpacePaddedAction.trim(), "sync");
  assert.throws(
    () => requireCanonicalEdgeEnum(emSpacePaddedAction, "action", ["sync"] as const),
    (error: unknown) =>
      error instanceof Error && /is not supported/i.test(error.message)
  );

  const nbspPaddedIso = `\u00a0${ISO_BOUND}\u00a0`;
  assert.equal(nbspPaddedIso.trim(), ISO_BOUND);
  assert.equal(Number.isFinite(Date.parse(nbspPaddedIso.trim())), true);
  assert.equal(Number.isFinite(Date.parse(asciiTrimEdgeString(nbspPaddedIso))), false);
  assert.throws(
    () => requireCanonicalEdgeIsoDateString(nbspPaddedIso, "from"),
    (error: unknown) =>
      error instanceof Error && /must be a valid ISO date string/i.test(error.message)
  );
});

test("empty-after-ASCII-trim still fails closed as required", () => {
  assert.throws(
    () => requireCanonicalEdgeString("   ", "action"),
    (error: unknown) => error instanceof Error && /is required/i.test(error.message)
  );
  assert.throws(
    () => requireCanonicalEdgeEnum("", "action", ["sync"] as const),
    (error: unknown) => error instanceof Error && /is required/i.test(error.message)
  );
});
