import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimRestaurantTasksObjectToken,
  canonicalizeRestaurantTasksObjectId,
  requireCanonicalRestaurantTasksTaskId
} from "../services/domain/restaurantTasksObjectIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantTasksObjectIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const taskId = "00000000-0000-4000-8000-000000000801";
const demoTaskId = "task-demo-count";

test("MISE-005MF pins restaurant-tasks taskId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MF/);
  assert.match(applicationSource, /MISE-005MF/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksObjectToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalRestaurantTasksTaskId\(taskId\)/
  );
  assert.match(
    applicationSource,
    /from "\.\.\/domain\/restaurantTasksObjectIdentity"/
  );

  // Leave restaurant workspace on Unicode trim (owned by #739 / MISE-005LI).
  assert.match(
    applicationSource,
    /export async function listSharedRestaurantTasks\(\s*restaurantId: string,\s*options: \{ includeCompleted\?: boolean \} = \{\}\s*\): Promise<RestaurantTask\[]> \{\s*const normalizedRestaurantId = restaurantId\.trim\(\);\s*if \(!normalizedRestaurantId\) throw new Error\("Missing restaurant workspace\."\);/s
  );
  assert.match(
    applicationSource,
    /const normalizedRestaurantId = restaurantId\.trim\(\);\s*\/\/ MISE-005MF: ASCII-C task identity for restaurant-task reopen\.\s*const normalizedTaskId = requireCanonicalRestaurantTasksTaskId\(taskId\);\s*if \(!normalizedRestaurantId\) \{\s*throw new Error\("Restaurant and task are required\."\);\s*\}/s
  );
  assert.doesNotMatch(applicationSource, /requireCanonicalRestaurantTasksWorkspaceId/);
  assert.doesNotMatch(applicationSource, /requireCanonicalRestaurantTasksReopenRestaurantId/);
  assert.doesNotMatch(applicationSource, /restaurantTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/restaurantTasksRestaurantIdentity"/);
  assert.doesNotMatch(
    identitySource,
    /export function (?:asciiTrim|canonicalize|requireCanonical)RestaurantTasksRestaurant/
  );

  // Leave completeSharedRestaurantTask input pass-through alone.
  assert.match(
    applicationSource,
    /export async function completeSharedRestaurantTask\(\s*input: CompleteRestaurantTaskInput\s*\): Promise<RestaurantTask> \{\s*return repository\.completeRestaurantTask\(input\);\s*\}/s
  );

  // Leave sibling tips alone (do not import or define their helpers here).
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
});

test("ASCII trim keeps ordinary restaurant-tasks taskId padding stable", () => {
  assert.equal(asciiTrimRestaurantTasksObjectToken(`  ${taskId}  `), taskId);
  assert.equal(canonicalizeRestaurantTasksObjectId(`\t${taskId}\n`), taskId);
  assert.equal(requireCanonicalRestaurantTasksTaskId(` ${taskId} `), taskId);

  assert.equal(asciiTrimRestaurantTasksObjectToken(`  ${demoTaskId}  `), demoTaskId);
  assert.equal(canonicalizeRestaurantTasksObjectId(`\t${demoTaskId}\n`), demoTaskId);
  assert.equal(requireCanonicalRestaurantTasksTaskId(` ${demoTaskId} `), demoTaskId);
});

test("ASCII restaurant-tasks taskId trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPaddedTask = `\u00a0${taskId}\u00a0`;
  // Unicode trim invents an exact match against the unpadded task id.
  assert.equal(nbspPaddedTask.trim(), taskId);
  assert.notEqual(asciiTrimRestaurantTasksObjectToken(nbspPaddedTask), taskId);
  assert.equal(canonicalizeRestaurantTasksObjectId(nbspPaddedTask), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksTaskId(nbspPaddedTask),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );

  const emSpacePaddedDemo = `\u2003${demoTaskId}\u2003`;
  assert.equal(emSpacePaddedDemo.trim(), demoTaskId);
  assert.equal(canonicalizeRestaurantTasksObjectId(emSpacePaddedDemo), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksTaskId(emSpacePaddedDemo),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
});

test("Restaurant-tasks taskId rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRestaurantTasksObjectId(""), null);
  assert.equal(canonicalizeRestaurantTasksObjectId("   "), null);
  assert.equal(canonicalizeRestaurantTasksObjectId("a".repeat(129)), null);
  assert.equal(canonicalizeRestaurantTasksObjectId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksTaskId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTaskId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTaskId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksTaskId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant and task are required."
  );
});
