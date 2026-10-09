import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupRestaurantToken,
  canonicalizeSetupRestaurantId,
  requireCanonicalSetupWorkspaceId
} from "../services/domain/setupRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/setupRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/setup.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LL pins setup restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LL/);
  assert.match(applicationSource, /MISE-005LL/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalSetupWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
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

test("ASCII trim keeps ordinary setup restaurant workspace padding stable", () => {
  assert.equal(asciiTrimSetupRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeSetupRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalSetupWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII setup restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimSetupRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeSetupRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSetupWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeSetupRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalSetupWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Setup restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSetupRestaurantId(""), null);
  assert.equal(canonicalizeSetupRestaurantId("   "), null);
  assert.equal(canonicalizeSetupRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeSetupRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSetupWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSetupWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSetupWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalSetupWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
