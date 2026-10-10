import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryMenuItemToken,
  canonicalizeInventoryMenuItemId,
  requireCanonicalInventoryMenuItemId
} from "../services/domain/inventoryMenuItemIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryMenuItemIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/inventory.ts", import.meta.url),
  "utf8"
);

const menuItemId = "00000000-0000-4000-8000-000000000901";
const demoMenuItemId = "menu-burger";

test("MISE-005MG pins inventory menuItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MG/);
  assert.match(applicationSource, /MISE-005MG/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryMenuItemToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalInventoryMenuItemId\(menuItemId\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/inventoryMenuItemIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #744 / MISE-005LN).
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*\/\/ MISE-005MG: ASCII-C menu-item identity for recipe-baseline confirmation\.\s*const normalizedMenuItemId = requireCanonicalInventoryMenuItemId\(menuItemId\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalInventoryWorkspaceId/);
  assert.doesNotMatch(applicationSource, /requireRestaurantId\(/);
  assert.doesNotMatch(applicationSource, /inventoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/inventoryRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)InventoryRestaurant/
  );

  // Leave recipe-mapping name/item/mapping trim surfaces alone.
  assert.match(
    applicationSource,
    /const menuItemName = input\.menuItemName\.trim\(\);/
  );
  assert.match(
    applicationSource,
    /const inventoryItemId = input\.inventoryItemId\.trim\(\);/
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /restaurantTasksObjectIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsObjectIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesSupplierOrderIdentity/);
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
  assert.doesNotMatch(identitySource, /deliveriesClientDeliveryIdentity/);
});

test("ASCII trim keeps ordinary inventory menuItemId padding stable", () => {
  assert.equal(asciiTrimInventoryMenuItemToken(`  ${menuItemId}  `), menuItemId);
  assert.equal(canonicalizeInventoryMenuItemId(`\t${menuItemId}\n`), menuItemId);
  assert.equal(requireCanonicalInventoryMenuItemId(` ${menuItemId} `), menuItemId);

  assert.equal(asciiTrimInventoryMenuItemToken(`  ${demoMenuItemId}  `), demoMenuItemId);
  assert.equal(canonicalizeInventoryMenuItemId(`\t${demoMenuItemId}\n`), demoMenuItemId);
  assert.equal(requireCanonicalInventoryMenuItemId(` ${demoMenuItemId} `), demoMenuItemId);
});

test("ASCII inventory menuItemId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedMenuItem = `\u00a0${menuItemId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded menu item id.
  assert.equal(nbspPaddedMenuItem.trim(), menuItemId);
  assert.notEqual(asciiTrimInventoryMenuItemToken(nbspPaddedMenuItem), menuItemId);
  assert.equal(canonicalizeInventoryMenuItemId(nbspPaddedMenuItem), null);
  assert.throws(
    () => requireCanonicalInventoryMenuItemId(nbspPaddedMenuItem),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing menu item."
  );

  const emSpacePaddedDemo = `\u2003${demoMenuItemId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoMenuItemId);
  assert.equal(canonicalizeInventoryMenuItemId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalInventoryMenuItemId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing menu item."
  );
});

test("Inventory menuItemId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryMenuItemId(""), null);
  assert.equal(canonicalizeInventoryMenuItemId("   "), null);
  assert.equal(canonicalizeInventoryMenuItemId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryMenuItemId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInventoryMenuItemId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing menu item."
  );
  assert.throws(
    () => requireCanonicalInventoryMenuItemId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing menu item."
  );
  assert.throws(
    () => requireCanonicalInventoryMenuItemId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing menu item."
  );
  assert.throws(
    () => requireCanonicalInventoryMenuItemId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing menu item."
  );
});
