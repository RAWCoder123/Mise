import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildDailyOperatingPlan } from "../services/domain/operatingPlan";
import {
  asciiTrimOperatingPlanRestaurantToken,
  canonicalizeOperatingPlanRestaurantId,
  requireCanonicalOperatingPlanRestaurantId,
  requireCanonicalOperatingPlanWorkspaceId
} from "../services/domain/operatingPlanRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operatingPlanRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operatingPlan.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/operatingPlan.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const now = new Date("2026-08-02T15:30:00.000Z");

function minimalPlanInput(restaurantId: string) {
  return {
    restaurantId,
    restaurantTimeZone: "America/New_York",
    operatingDate: "2026-08-02",
    prepWindows: ["AM"] as string[],
    tasks: [],
    orders: [],
    recommendations: [],
    activityEvents: [],
    now
  };
}

test("MISE-005LF pins operating-plan restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LF/);
  assert.match(domainSource, /MISE-005LF/);
  assert.match(applicationSource, /MISE-005LF/);

  assert.match(
    identitySource,
    /export function asciiTrimOperatingPlanRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalOperatingPlanRestaurantId\(restaurantId\)/);
  assert.match(applicationSource, /requireCanonicalOperatingPlanWorkspaceId\(restaurantId\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /recalculationRunTransport/);
  assert.doesNotMatch(identitySource, /recalculationSchedule/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
});

test("ASCII trim keeps ordinary operating-plan restaurant workspace padding stable", () => {
  assert.equal(asciiTrimOperatingPlanRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeOperatingPlanRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalOperatingPlanRestaurantId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalOperatingPlanWorkspaceId(` ${workspace} `), workspace);

  const plan = buildDailyOperatingPlan(minimalPlanInput(` ${workspace} `));
  assert.equal(plan.restaurantId, workspace);
});

test("ASCII operating-plan restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimOperatingPlanRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeOperatingPlanRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOperatingPlanRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to build an operating plan."
  );
  assert.throws(
    () => requireCanonicalOperatingPlanWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => buildDailyOperatingPlan(minimalPlanInput(nbspPadded)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to build an operating plan."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeOperatingPlanRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOperatingPlanRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to build an operating plan."
  );
  assert.throws(
    () => buildDailyOperatingPlan(minimalPlanInput(emSpacePadded)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to build an operating plan."
  );
});

test("ASCII operating-plan restaurant canonicalize rejects empty, control, and over-long tokens", () => {
  assert.equal(canonicalizeOperatingPlanRestaurantId("   "), null);
  assert.equal(canonicalizeOperatingPlanRestaurantId(`\u0000${workspace}`), null);
  assert.equal(canonicalizeOperatingPlanRestaurantId("a".repeat(129)), null);
  assert.throws(
    () => requireCanonicalOperatingPlanRestaurantId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "A restaurant is required to build an operating plan."
  );
  assert.throws(
    () => requireCanonicalOperatingPlanWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
