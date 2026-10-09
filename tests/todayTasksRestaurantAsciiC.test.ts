import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { deriveOperationalTodayTasks } from "../services/domain/todayTasks";
import {
  asciiTrimTodayTasksRestaurantToken,
  canonicalizeTodayTasksRestaurantId,
  requireCanonicalTodayTasksRestaurantId,
  requireCanonicalTodayTasksWorkspaceId
} from "../services/domain/todayTasksRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/todayTasksRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/todayTasks.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/today.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const now = new Date("2026-07-19T03:30:00.000Z");

function minimalDeriveInput(restaurantId: string) {
  return {
    restaurantId,
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    setupReadiness: null,
    posIntegrations: [],
    insights: [],
    now
  };
}

test("MISE-005LG pins Today-tasks restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LG/);
  assert.match(domainSource, /MISE-005LG/);
  assert.match(applicationSource, /MISE-005LG/);

  assert.match(
    identitySource,
    /export function asciiTrimTodayTasksRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalTodayTasksRestaurantId\(restaurantId\)/);
  assert.match(applicationSource, /requireCanonicalTodayTasksWorkspaceId\(restaurantId\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /operatingPlanRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /recalculationRunTransport/);
  assert.doesNotMatch(identitySource, /recalculationSchedule/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
});

test("ASCII trim keeps ordinary Today-tasks restaurant workspace padding stable", () => {
  assert.equal(asciiTrimTodayTasksRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeTodayTasksRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalTodayTasksRestaurantId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalTodayTasksWorkspaceId(` ${workspace} `), workspace);

  const tasks = deriveOperationalTodayTasks(minimalDeriveInput(` ${workspace} `));
  assert.ok(Array.isArray(tasks));
  assert.ok(tasks.every((task) => task.restaurantId === workspace));
});

test("ASCII Today-tasks restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimTodayTasksRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeTodayTasksRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalTodayTasksRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to derive Today tasks."
  );
  assert.throws(
    () => requireCanonicalTodayTasksWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => deriveOperationalTodayTasks(minimalDeriveInput(nbspPadded)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to derive Today tasks."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeTodayTasksRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalTodayTasksRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to derive Today tasks."
  );
  assert.throws(
    () => deriveOperationalTodayTasks(minimalDeriveInput(emSpacePadded)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to derive Today tasks."
  );
});

test("ASCII Today-tasks restaurant canonicalize rejects empty, control, and over-long tokens", () => {
  assert.equal(canonicalizeTodayTasksRestaurantId("   "), null);
  assert.equal(canonicalizeTodayTasksRestaurantId(`\u0000${workspace}`), null);
  assert.equal(canonicalizeTodayTasksRestaurantId("a".repeat(129)), null);
  assert.throws(
    () => requireCanonicalTodayTasksRestaurantId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to derive Today tasks."
  );
  assert.throws(
    () => requireCanonicalTodayTasksWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
