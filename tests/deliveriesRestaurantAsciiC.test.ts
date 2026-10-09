import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDeliveriesRestaurantToken,
  canonicalizeDeliveriesRestaurantId,
  requireCanonicalDeliveriesWorkspaceId
} from "../services/domain/deliveriesRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/deliveriesRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/deliveries.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LR pins deliveries restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LR/);
  assert.match(applicationSource, /MISE-005LR/);

  assert.match(
    identitySource,
    /export function asciiTrimDeliveriesRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalDeliveriesWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
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
  assert.doesNotMatch(identitySource, /findingDecisionsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
});

test("ASCII trim keeps ordinary deliveries workspace padding stable", () => {
  assert.equal(asciiTrimDeliveriesRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeDeliveriesRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalDeliveriesWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII deliveries trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimDeliveriesRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeDeliveriesRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalDeliveriesWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeDeliveriesRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalDeliveriesWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Deliveries workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeDeliveriesRestaurantId(""), null);
  assert.equal(canonicalizeDeliveriesRestaurantId("   "), null);
  assert.equal(canonicalizeDeliveriesRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeDeliveriesRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalDeliveriesWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDeliveriesWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDeliveriesWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalDeliveriesWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
