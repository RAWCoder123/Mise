import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOrdersWorkflowRestaurantToken,
  canonicalizeOrdersWorkflowRestaurantId,
  requireCanonicalOrdersWorkflowRestaurantId
} from "../services/domain/ordersWorkflowRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/ordersWorkflowRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/orders.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LZ pins orders requireWorkflowId restaurant to ASCII C", () => {
  assert.match(identitySource, /MISE-005LZ/);
  assert.match(applicationSource, /MISE-005LZ/);

  assert.match(
    identitySource,
    /export function asciiTrimOrdersWorkflowRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalOrdersWorkflowRestaurantId\(value\)/);
  assert.match(applicationSource, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(
    applicationSource,
    /function requireWorkflowId\(value: string, label: string\) \{\s*if \(label === "restaurant"\) \{\s*return requireCanonicalOrdersWorkflowRestaurantId\(value\);/s
  );

  // Leave authorities path (#754) Unicode trim alone on main.
  assert.match(
    applicationSource,
    /export async function fetchPurchaseRecommendationAuthorities\(\s*restaurantId: string\s*\): Promise<Record<string, PurchaseAuthorityResult>> \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalOrdersWorkspaceId/);
  assert.doesNotMatch(applicationSource, /ordersRestaurantIdentity/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /from "\.\/ordersRestaurantIdentity"/);
  assert.doesNotMatch(identitySource, /export function (?:asciiTrim|canonicalize|requireCanonical)OrdersRestaurant/);
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
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
});

test("ASCII trim keeps ordinary orders workflow restaurant padding stable", () => {
  assert.equal(asciiTrimOrdersWorkflowRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeOrdersWorkflowRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalOrdersWorkflowRestaurantId(` ${workspace} `), workspace);
});

test("ASCII orders workflow trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimOrdersWorkflowRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeOrdersWorkflowRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowRestaurantId(nbspPadded),
    (error: unknown) => error instanceof Error && error.message === "Missing restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeOrdersWorkflowRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowRestaurantId(emSpacePadded),
    (error: unknown) => error instanceof Error && error.message === "Missing restaurant."
  );
});

test("Orders workflow restaurant rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOrdersWorkflowRestaurantId(""), null);
  assert.equal(canonicalizeOrdersWorkflowRestaurantId("   "), null);
  assert.equal(canonicalizeOrdersWorkflowRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeOrdersWorkflowRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOrdersWorkflowRestaurantId(null),
    (error: unknown) => error instanceof Error && error.message === "Missing restaurant."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkflowRestaurantId(""),
    (error: unknown) => error instanceof Error && error.message === "Missing restaurant."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkflowRestaurantId("bad\u0000id"),
    (error: unknown) => error instanceof Error && error.message === "Missing restaurant."
  );
  assert.throws(
    () => requireCanonicalOrdersWorkflowRestaurantId(undefined),
    (error: unknown) => error instanceof Error && error.message === "Missing restaurant."
  );
});
