import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInsightsRestaurantToken,
  canonicalizeInsightsRestaurantId,
  requireCanonicalInsightsWorkspaceId
} from "../services/domain/insightsRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/insightsRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/insights.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LJ pins Insights restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LJ/);
  assert.match(applicationSource, /MISE-005LJ/);

  assert.match(
    identitySource,
    /export function asciiTrimInsightsRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalInsightsWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
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

test("ASCII trim keeps ordinary Insights restaurant workspace padding stable", () => {
  assert.equal(asciiTrimInsightsRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeInsightsRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalInsightsWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII Insights restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimInsightsRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeInsightsRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalInsightsWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeInsightsRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalInsightsWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Insights restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInsightsRestaurantId(""), null);
  assert.equal(canonicalizeInsightsRestaurantId("   "), null);
  assert.equal(canonicalizeInsightsRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeInsightsRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInsightsWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInsightsWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInsightsWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInsightsWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
