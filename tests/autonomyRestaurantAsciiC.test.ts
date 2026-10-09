import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAutonomyRestaurantToken,
  canonicalizeAutonomyRestaurantId,
  requireCanonicalAutonomyWorkspaceId
} from "../services/domain/autonomyRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/autonomyRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/autonomy.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LK pins autonomy restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LK/);
  assert.match(applicationSource, /MISE-005LK/);

  assert.match(
    identitySource,
    /export function asciiTrimAutonomyRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalAutonomyWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
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
});

test("ASCII trim keeps ordinary autonomy restaurant workspace padding stable", () => {
  assert.equal(asciiTrimAutonomyRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeAutonomyRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalAutonomyWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII autonomy restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimAutonomyRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeAutonomyRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalAutonomyWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeAutonomyRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalAutonomyWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Autonomy restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeAutonomyRestaurantId(""), null);
  assert.equal(canonicalizeAutonomyRestaurantId("   "), null);
  assert.equal(canonicalizeAutonomyRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeAutonomyRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalAutonomyWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalAutonomyWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalAutonomyWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalAutonomyWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
