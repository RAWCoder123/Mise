import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersRestaurantToken,
  canonicalizeOrdersRestaurantId,
  requireCanonicalOrdersWorkspaceId
} from "../services/domain/ordersRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/orders.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LX pins orders authorities restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LX/);
  assert.match(applicationSource, /MISE-005LX/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalOrdersWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantWorkspaceId\(restaurantId\)/);
  assert.match(
    applicationSource,
    /export async function fetchPurchaseRecommendationAuthorities\(\s*restaurantId: string\s*\): Promise<Record<string, PurchaseAuthorityResult>> \{\s*const normalizedRestaurantId = requireRestaurantWorkspaceId\(restaurantId\);/s
  );

  // Leave requireWorkflowId Unicode trim alone (gmailClient contract).
  assert.match(applicationSource, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(
    applicationSource,
    /function requireWorkflowId\(value: string, label: string\) \{\s*const normalized = typeof value === "string" \? value\.trim\(\) : "";/s
  );

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyReportRestaurantIdentity/);
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
  assert.doesNotMatch(identitySource, /operationalFindings/);
});

test("ASCII trim keeps ordinary orders workspace padding stable", () => {
  assert.equal(asciiTrimOrdersRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeOrdersRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalOrdersWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII orders trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimOrdersRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeOrdersRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOrdersWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeOrdersRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOrdersWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Orders workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOrdersRestaurantId(""), null);
  assert.equal(canonicalizeOrdersRestaurantId("   "), null);
  assert.equal(canonicalizeOrdersRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeOrdersRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOrdersWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
