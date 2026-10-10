import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryItemToken,
  canonicalizeInventoryItemId,
  requireCanonicalInventoryItemId
} from "../services/domain/inventoryItemIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryItemIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const inventoryItemId = "00000000-0000-4000-8000-000000000801";
const demoInventoryItemId = "inv-flour";

test("MISE-005MK pins inventory inventoryItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MK/);
  assert.match(applicationSource, /MISE-005MK/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryItemToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalInventoryItemId\(input\.inventoryItemId\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/inventoryItemIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #744 / MISE-005LN).
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*const normalizedMenuItemId = menuItemId\.trim\(\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalInventoryWorkspaceId/);
  assert.doesNotMatch(applicationSource, /requireRestaurantId\(/);
  assert.doesNotMatch(applicationSource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)InventoryRestaurant/
  );

  // Leave menuItemId confirm path on Unicode trim (owned by #763 / MISE-005MG).
  assert.match(
    applicationSource,
    /const normalizedMenuItemId = menuItemId\.trim\(\);/
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalInventoryMenuItemId/);
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)InventoryMenuItem/
  );

  // Leave recipe-mapping name/unit trim surfaces alone.
  assert.match(
    applicationSource,
    /const menuItemName = input\.menuItemName\.trim\(\);/
  );
  assert.match(
    applicationSource,
    /const unit = input\.unit\.trim\(\);/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /inventoryMenuItemIdentity/);
  assert.doesNotMatch(identitySource, /floorNotesObjectIdentity/);
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
  assert.doesNotMatch(identitySource, /ordersWorkflowObjectIdentity/);
  assert.doesNotMatch(identitySource, /posMappingWorkflowIdentity/);
  assert.doesNotMatch(identitySource, /posRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operationalFindingsRestaurantIdentity/);
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
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesObjectIdentity/);
});

test("ASCII trim keeps ordinary inventory inventoryItemId padding stable", () => {
  assert.equal(asciiTrimInventoryItemToken(`  ${inventoryItemId}  `), inventoryItemId);
  assert.equal(canonicalizeInventoryItemId(`\t${inventoryItemId}\n`), inventoryItemId);
  assert.equal(requireCanonicalInventoryItemId(` ${inventoryItemId} `), inventoryItemId);

  assert.equal(asciiTrimInventoryItemToken(`  ${demoInventoryItemId}  `), demoInventoryItemId);
  assert.equal(canonicalizeInventoryItemId(`\t${demoInventoryItemId}\n`), demoInventoryItemId);
  assert.equal(requireCanonicalInventoryItemId(` ${demoInventoryItemId} `), demoInventoryItemId);
});

test("ASCII inventory inventoryItemId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedItem = `\u00a0${inventoryItemId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded inventory item id.
  assert.equal(nbspPaddedItem.trim(), inventoryItemId);
  assert.notEqual(asciiTrimInventoryItemToken(nbspPaddedItem), inventoryItemId);
  assert.equal(canonicalizeInventoryItemId(nbspPaddedItem), null);
  assert.throws(
    () => requireCanonicalInventoryItemId(nbspPaddedItem),
    (error: unknown) =>
      error instanceof Error && error.message === "Choose an inventory item."
  );

  const emSpacePaddedDemo = `\u2003${demoInventoryItemId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoInventoryItemId);
  assert.equal(canonicalizeInventoryItemId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalInventoryItemId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Choose an inventory item."
  );
});

test("Inventory inventoryItemId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryItemId(""), null);
  assert.equal(canonicalizeInventoryItemId("   "), null);
  assert.equal(canonicalizeInventoryItemId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryItemId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInventoryItemId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Choose an inventory item."
  );
  assert.throws(
    () => requireCanonicalInventoryItemId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Choose an inventory item."
  );
  assert.throws(
    () => requireCanonicalInventoryItemId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Choose an inventory item."
  );
  assert.throws(
    () => requireCanonicalInventoryItemId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Choose an inventory item."
  );
});
