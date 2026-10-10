import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimOperationalFindingsRestaurantToken,
  canonicalizeOperationalFindingsRestaurantId,
  requireCanonicalOperationalFindingsWorkspaceId
} from "../services/domain/operationalFindingsRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/operationalFindingsRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/operationalFindings.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/findings.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LY pins operational-findings restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LY/);
  assert.match(domainSource, /MISE-005LY/);

  assert.match(
    identitySource,
    /export function asciiTrimOperationalFindingsRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalOperationalFindingsWorkspaceId\(input\.restaurantId\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const restaurantId = input\.restaurantId\.trim\(\)/);

  // Leave application findings (#752) and sibling tips alone.
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
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

  // Application findings tip (#752) owns application/findings.ts — leave its Unicode trim on main.
  assert.match(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /requireCanonicalOperationalFindingsWorkspaceId/);
  assert.doesNotMatch(applicationSource, /MISE-005LY/);
});

test("ASCII trim keeps ordinary operational-findings workspace padding stable", () => {
  assert.equal(asciiTrimOperationalFindingsRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeOperationalFindingsRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalOperationalFindingsWorkspaceId(` ${workspace} `), workspace);
});

test("ASCII operational-findings trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimOperationalFindingsRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeOperationalFindingsRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalOperationalFindingsWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeOperationalFindingsRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalOperationalFindingsWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("Operational-findings workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeOperationalFindingsRestaurantId(""), null);
  assert.equal(canonicalizeOperationalFindingsRestaurantId("   "), null);
  assert.equal(canonicalizeOperationalFindingsRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeOperationalFindingsRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalOperationalFindingsWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingsWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingsWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalOperationalFindingsWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
