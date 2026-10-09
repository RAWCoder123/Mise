import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPilotReadinessRestaurantToken,
  canonicalizePilotReadinessRestaurantId,
  requireCanonicalPilotReadinessWorkspaceId
} from "../services/domain/pilotReadinessRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/pilotReadinessRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/pilotReadiness.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LO pins pilot-readiness restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LO/);
  assert.match(applicationSource, /MISE-005LO/);

  assert.match(
    identitySource,
    /export function asciiTrimPilotReadinessRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalPilotReadinessWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantAppRestaurantIdentity/);
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

test("ASCII trim keeps ordinary pilot-readiness workspace padding stable", () => {
  assert.equal(asciiTrimPilotReadinessRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizePilotReadinessRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalPilotReadinessWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII pilot-readiness trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimPilotReadinessRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizePilotReadinessRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalPilotReadinessWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizePilotReadinessRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalPilotReadinessWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Pilot-readiness workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizePilotReadinessRestaurantId(""), null);
  assert.equal(canonicalizePilotReadinessRestaurantId("   "), null);
  assert.equal(canonicalizePilotReadinessRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizePilotReadinessRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalPilotReadinessWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalPilotReadinessWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalPilotReadinessWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalPilotReadinessWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
