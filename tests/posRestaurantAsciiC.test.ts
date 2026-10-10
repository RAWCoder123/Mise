import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPosRestaurantToken,
  canonicalizePosRestaurantId,
  requireCanonicalPosRestaurantId
} from "../services/domain/posRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/posRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/pos.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005MA pins POS requireWorkflowId restaurant to ASCII C", () => {
  assert.match(identitySource, /MISE-005MA/);
  assert.match(applicationSource, /MISE-005MA/);

  assert.match(
    identitySource,
    /export function asciiTrimPosRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(applicationSource, /requireCanonicalPosRestaurantId\(value\)/);
  assert.match(applicationSource, /requireWorkflowId\(restaurantId, "restaurant"\)/);
  assert.match(
    applicationSource,
    /function requireWorkflowId\(value: string, label: string\) \{\s*if \(label === "restaurant"\) \{\s*return requireCanonicalPosRestaurantId\(value\);/s
  );

  // Leave non-restaurant workflow labels on Unicode trim.
  assert.match(applicationSource, /requireWorkflowId\(mappingId, "mapping"\)/);
  assert.match(
    applicationSource,
    /menuItemId === null \? null : requireWorkflowId\(menuItemId, "menu item"\)/
  );
  assert.match(
    applicationSource,
    /const normalized = value\.trim\(\);\s*if \(!normalized\) throw new Error\(`A valid \$\{label\} id is required\.`\);/s
  );

  // Leave sibling tips alone (do not import or define their helpers here).
  assert.doesNotMatch(identitySource, /from "\.\/ordersWorkflowRestaurantIdentity"/);
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

test("ASCII trim keeps ordinary POS restaurant padding stable", () => {
  assert.equal(asciiTrimPosRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizePosRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalPosRestaurantId(` ${workspace} `), workspace);
});

test("ASCII POS trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimPosRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizePosRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalPosRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid restaurant id is required."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizePosRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalPosRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid restaurant id is required."
  );
});

test("POS restaurant rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizePosRestaurantId(""), null);
  assert.equal(canonicalizePosRestaurantId("   "), null);
  assert.equal(canonicalizePosRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizePosRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalPosRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid restaurant id is required."
  );
  assert.throws(
    () => requireCanonicalPosRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid restaurant id is required."
  );
  assert.throws(
    () => requireCanonicalPosRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid restaurant id is required."
  );
  assert.throws(
    () => requireCanonicalPosRestaurantId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "A valid restaurant id is required."
  );
});
