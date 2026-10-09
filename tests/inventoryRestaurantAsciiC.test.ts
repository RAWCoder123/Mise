import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryRestaurantToken,
  canonicalizeInventoryRestaurantId,
  requireCanonicalInventoryWorkspaceId
} from "../services/domain/inventoryRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LN pins inventory restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LN/);
  assert.match(applicationSource, /MISE-005LN/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalInventoryWorkspaceId\(restaurantId\)/);
  assert.match(applicationSource, /requireRestaurantId\(restaurantId\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
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

test("ASCII trim keeps ordinary inventory workspace padding stable", () => {
  assert.equal(asciiTrimInventoryRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeInventoryRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalInventoryWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII inventory trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimInventoryRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeInventoryRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalInventoryWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeInventoryRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalInventoryWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Inventory workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryRestaurantId(""), null);
  assert.equal(canonicalizeInventoryRestaurantId("   "), null);
  assert.equal(canonicalizeInventoryRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInventoryWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInventoryWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInventoryWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalInventoryWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
