import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimFloorNoteRestaurantToken,
  canonicalizeFloorNoteRestaurantId,
  requireCanonicalFloorNoteRestaurantId
} from "../services/domain/floorNoteRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/floorNoteRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/floorNotes.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LA pins floor-note restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LA/);
  assert.match(applicationSource, /MISE-005LA/);

  assert.match(
    identitySource,
    /export function asciiTrimFloorNoteRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalFloorNoteRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierRecipientRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
});

test("ASCII trim keeps ordinary floor-note restaurant workspace padding stable", () => {
  assert.equal(asciiTrimFloorNoteRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeFloorNoteRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalFloorNoteRestaurantId(` ${workspace} `), workspace);
});

test("ASCII floor-note restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimFloorNoteRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeFloorNoteRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalFloorNoteRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeFloorNoteRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalFloorNoteRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("floor-note restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeFloorNoteRestaurantId(""), null);
  assert.equal(canonicalizeFloorNoteRestaurantId("   "), null);
  assert.equal(canonicalizeFloorNoteRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeFloorNoteRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalFloorNoteRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalFloorNoteRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalFloorNoteRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
