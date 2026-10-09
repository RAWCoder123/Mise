import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantTasksRestaurantToken,
  canonicalizeRestaurantTasksRestaurantId,
  requireCanonicalRestaurantTasksReopenRestaurantId,
  requireCanonicalRestaurantTasksWorkspaceId
} from "../services/domain/restaurantTasksRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LI pins restaurant-tasks restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LI/);
  assert.match(applicationSource, /MISE-005LI/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalRestaurantTasksWorkspaceId\(restaurantId\)/
  );
  assert.match(
    applicationSource,
    /requireCanonicalRestaurantTasksReopenRestaurantId\(restaurantId\)/
  );
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);
  // Leave task-id trim alone on this tip.
  assert.match(applicationSource, /taskId\.trim\(\)/);

  // Leave sibling tips alone.
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

test("ASCII trim keeps ordinary restaurant-tasks restaurant workspace padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeRestaurantTasksRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalRestaurantTasksWorkspaceId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalRestaurantTasksReopenRestaurantId(` ${workspace} `), workspace);
});

test("ASCII restaurant-tasks restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimRestaurantTasksRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeRestaurantTasksRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksReopenRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeRestaurantTasksRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksReopenRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
});

test("restaurant-tasks restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRestaurantTasksRestaurantId(""), null);
  assert.equal(canonicalizeRestaurantTasksRestaurantId("   "), null);
  assert.equal(canonicalizeRestaurantTasksRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeRestaurantTasksRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksReopenRestaurantId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
});
