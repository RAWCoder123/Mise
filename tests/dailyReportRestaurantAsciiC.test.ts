import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDailyReportRestaurantToken,
  canonicalizeDailyReportRestaurantId,
  requireCanonicalDailyReportWorkspaceId
} from "../services/domain/dailyReportRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/dailyReportRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/dailyReport.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LT pins daily-report restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LT/);
  assert.match(applicationSource, /MISE-005LT/);

  assert.match(
    identitySource,
    /export function asciiTrimDailyReportRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalDailyReportWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /findingDecisionsRestaurantIdentity/);
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
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
});

test("ASCII trim keeps ordinary daily-report workspace padding stable", () => {
  assert.equal(asciiTrimDailyReportRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeDailyReportRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalDailyReportWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII daily-report trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimDailyReportRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeDailyReportRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalDailyReportWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeDailyReportRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalDailyReportWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Daily-report workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeDailyReportRestaurantId(""), null);
  assert.equal(canonicalizeDailyReportRestaurantId("   "), null);
  assert.equal(canonicalizeDailyReportRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeDailyReportRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalDailyReportWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDailyReportWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDailyReportWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDailyReportWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
