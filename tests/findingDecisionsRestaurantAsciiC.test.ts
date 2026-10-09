import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimFindingDecisionsRestaurantToken,
  canonicalizeFindingDecisionsRestaurantId,
  requireCanonicalFindingDecisionsWorkspaceId
} from "../services/domain/findingDecisionsRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/findingDecisionsRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/findingDecisions.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LS pins finding-decisions restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LS/);
  assert.match(applicationSource, /MISE-005LS/);

  assert.match(
    identitySource,
    /export function asciiTrimFindingDecisionsRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalFindingDecisionsWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyPhaseBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingBriefRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /pilotReadinessRestaurantIdentity/);
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
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
});

test("ASCII trim keeps ordinary finding-decisions workspace padding stable", () => {
  assert.equal(asciiTrimFindingDecisionsRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeFindingDecisionsRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalFindingDecisionsWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII finding-decisions trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimFindingDecisionsRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeFindingDecisionsRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalFindingDecisionsWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeFindingDecisionsRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalFindingDecisionsWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Finding-decisions workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeFindingDecisionsRestaurantId(""), null);
  assert.equal(canonicalizeFindingDecisionsRestaurantId("   "), null);
  assert.equal(canonicalizeFindingDecisionsRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeFindingDecisionsRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalFindingDecisionsWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalFindingDecisionsWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalFindingDecisionsWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalFindingDecisionsWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
