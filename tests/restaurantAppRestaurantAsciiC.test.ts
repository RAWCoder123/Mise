import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantAppRestaurantToken,
  canonicalizeRestaurantAppRestaurantId,
  requireCanonicalRestaurantAppWorkspaceId
} from "../services/domain/restaurantAppRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantAppRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/restaurant.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LM pins restaurant app restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LM/);
  assert.match(applicationSource, /MISE-005LM/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantAppRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalRestaurantAppWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /setupRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /autonomyRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /todayTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /recalculationRunTransport/);
  assert.doesNotMatch(identitySource, /recalculationSchedule/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
});

test("ASCII trim keeps ordinary restaurant app workspace padding stable", () => {
  assert.equal(asciiTrimRestaurantAppRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeRestaurantAppRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalRestaurantAppWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII restaurant app trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimRestaurantAppRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeRestaurantAppRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRestaurantAppWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeRestaurantAppRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRestaurantAppWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Restaurant app workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRestaurantAppRestaurantId(""), null);
  assert.equal(canonicalizeRestaurantAppRestaurantId("   "), null);
  assert.equal(canonicalizeRestaurantAppRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeRestaurantAppRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRestaurantAppWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantAppWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantAppWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantAppWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
