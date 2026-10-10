import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosMappingWorkflowToken,
  canonicalizePosMappingWorkflowId,
  requireCanonicalPosMappingWorkflowId
} from "../services/domain/posMappingWorkflowIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/posMappingWorkflowIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/pos.ts", import.meta.url),
  "utf8"
);

const mappingId = "mapping-pos-review";
const menuItemId = "demo-menu:house salad";

test("MISE-005MB pins POS requireWorkflowId mapping and menu item to ASCII C", () => {
  assert.match(identitySource, /MISE-005MB/);
  assert.match(applicationSource, /MISE-005MB/);

  assert.match(
    identitySource,
    /export function asciiTrimPosMappingWorkflowToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalPosMappingWorkflowId\(value, label\)/);
  assert.match(applicationSource, /requireWorkflowId\(mappingId, "mapping"\)/);
  assert.match(
    applicationSource,
    /menuItemId === null \? null : requireWorkflowId\(menuItemId, "menu item"\)/
  );
  assert.match(
    applicationSource,
    /function requireWorkflowId\(value: string, label: string\) \{\s*if \(label === "mapping" \|\| label === "menu item"\) \{\s*return requireCanonicalPosMappingWorkflowId\(value, label\);/s
  );

  // Leave restaurant workflow label on Unicode trim (owned by #757 / MISE-005MA).
  assert.match(applicationSource, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(
    applicationSource,
    /const normalized = value\.trim\(\);\s*if \(!normalized\) throw new Error\(`A valid \$\{label\} id is required\.`\);/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalPosRestaurantId/);
  assert.doesNotMatch(identitySource, /posRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/posRestaurantIdentity"/);

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /ordersWorkflowRestaurantIdentity/);
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
});

test("ASCII trim keeps ordinary POS mapping and menu-item padding stable", () => {
  assert.equal(asciiTrimPosMappingWorkflowToken(`  ${mappingId}  `), mappingId);
  assert.equal(canonicalizePosMappingWorkflowId(`\t${mappingId}\n`), mappingId);
  assert.equal(requireCanonicalPosMappingWorkflowId(` ${mappingId} `, "mapping"), mappingId);

  assert.equal(asciiTrimPosMappingWorkflowToken(`  ${menuItemId}  `), menuItemId);
  assert.equal(canonicalizePosMappingWorkflowId(`\t${menuItemId}\n`), menuItemId);
  assert.equal(
    requireCanonicalPosMappingWorkflowId(` ${menuItemId} `, "menu item"),
    menuItemId
  );
});

test("ASCII POS mapping trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedMapping = `\u00a0${mappingId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded mapping id.
  assert.equal(nbspPaddedMapping.trim(), mappingId);
  assert.notEqual(asciiTrimPosMappingWorkflowToken(nbspPaddedMapping), mappingId);
  assert.equal(canonicalizePosMappingWorkflowId(nbspPaddedMapping), null);
  assert.throws(
    () => requireCanonicalPosMappingWorkflowId(nbspPaddedMapping, "mapping"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid mapping id is required."
  );

  const emSpacePaddedMenuItem = `\u2003${menuItemId}\u2003`;
  assert.equal(emSpacePaddedMenuItem.trim(), menuItemId);
  assert.equal(canonicalizePosMappingWorkflowId(emSpacePaddedMenuItem), null);
  assert.throws(
    () => requireCanonicalPosMappingWorkflowId(emSpacePaddedMenuItem, "menu item"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid menu item id is required."
  );
});

test("POS mapping workflow rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizePosMappingWorkflowId(""), null);
  assert.equal(canonicalizePosMappingWorkflowId("   "), null);
  assert.equal(canonicalizePosMappingWorkflowId("a".repeat(129)), null);
  assert.equal(canonicalizePosMappingWorkflowId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalPosMappingWorkflowId(null, "mapping"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid mapping id is required."
  );
  assert.throws(
    () => requireCanonicalPosMappingWorkflowId("", "menu item"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid menu item id is required."
  );
  assert.throws(
    () => requireCanonicalPosMappingWorkflowId(undefined, "menu item"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid menu item id is required."
  );
  assert.throws(
    () => requireCanonicalPosMappingWorkflowId("bad\u0000id", "mapping"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid mapping id is required."
  );
});
