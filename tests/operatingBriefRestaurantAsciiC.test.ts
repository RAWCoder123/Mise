import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOperatingBriefRestaurantToken,
  canonicalizeOperatingBriefRestaurantId,
  requireCanonicalOperatingBriefWorkspaceId
} from "../services/domain/operatingBriefRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operatingBriefRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/operatingBrief.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LP pins operating-brief restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LP/);
  assert.match(applicationSource, /MISE-005LP/);

  assert.match(
    identitySource,
    /export function asciiTrimOperatingBriefRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalOperatingBriefWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
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
});

test("ASCII trim keeps ordinary operating-brief workspace padding stable", () => {
  assert.equal(asciiTrimOperatingBriefRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeOperatingBriefRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalOperatingBriefWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII operating-brief trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimOperatingBriefRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeOperatingBriefRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOperatingBriefWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeOperatingBriefRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOperatingBriefWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Operating-brief workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOperatingBriefRestaurantId(""), null);
  assert.equal(canonicalizeOperatingBriefRestaurantId("   "), null);
  assert.equal(canonicalizeOperatingBriefRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeOperatingBriefRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOperatingBriefWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOperatingBriefWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOperatingBriefWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOperatingBriefWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
