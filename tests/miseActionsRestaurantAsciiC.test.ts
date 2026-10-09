import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPreparedAction,
  measureOutcome,
  miseActionIdempotencyKey
} from "../services/domain/miseActions";
import {
  asciiTrimMiseActionsRestaurantToken,
  canonicalizeMiseActionsRestaurantId,
  requireCanonicalMiseActionsOutcomeRestaurantId,
  requireCanonicalMiseActionsRestaurantId,
  requireCanonicalMiseActionsWorkspaceId
} from "../services/domain/miseActionsRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/miseActionsRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/miseActions.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/miseActions.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LH pins Mise-actions restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LH/);
  assert.match(domainSource, /MISE-005LH/);
  assert.match(applicationSource, /MISE-005LH/);

  assert.match(
    identitySource,
    /export function asciiTrimMiseActionsRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalMiseActionsRestaurantId\(restaurantId\)/);
  assert.match(domainSource, /requireCanonicalMiseActionsRestaurantId\(input\.restaurantId\)/);
  assert.match(
    domainSource,
    /requireCanonicalMiseActionsOutcomeRestaurantId\(input\.restaurantId\)/
  );
  assert.match(applicationSource, /requireCanonicalMiseActionsWorkspaceId\(restaurantId\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /return `\$\{restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /const normalizedRestaurantId = restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /todayTasksRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /operatingPlanRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /recalculationRunTransport/);
  assert.doesNotMatch(identitySource, /recalculationSchedule/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
});

test("ASCII trim keeps ordinary Mise-actions restaurant workspace padding stable", () => {
  assert.equal(asciiTrimMiseActionsRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeMiseActionsRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalMiseActionsRestaurantId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalMiseActionsOutcomeRestaurantId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalMiseActionsWorkspaceId(` ${workspace} `), workspace);

  const action = createPreparedAction({
    restaurantId: ` ${workspace} `,
    actionType: "create_internal_task",
    idempotencyKey: miseActionIdempotencyKey(` ${workspace} `, "create_internal_task", "task_1"),
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(action.restaurantId, workspace);
  assert.equal(action.idempotencyKey, `${workspace}:create_internal_task:task_1`);

  const outcome = measureOutcome({
    restaurantId: ` ${workspace} `,
    actionId: "action_1",
    expectedResult: { count: 1 },
    actualResult: { count: 1 }
  });
  assert.equal(outcome.restaurantId, workspace);
});

test("ASCII Mise-actions restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimMiseActionsRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeMiseActionsRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalMiseActionsRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a restaurant id."
  );
  assert.throws(
    () => requireCanonicalMiseActionsOutcomeRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Outcomes require a restaurant id."
  );
  assert.throws(
    () => requireCanonicalMiseActionsWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () =>
      createPreparedAction({
        restaurantId: nbspPadded,
        actionType: "create_internal_task",
        idempotencyKey: "task:safe"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a restaurant id."
  );
  assert.throws(
    () => miseActionIdempotencyKey(nbspPadded, "create_internal_task", "task_1"),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a restaurant id."
  );
  assert.throws(
    () =>
      measureOutcome({
        restaurantId: nbspPadded,
        actionId: "action_1",
        expectedResult: {},
        actualResult: {}
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Outcomes require a restaurant id."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeMiseActionsRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalMiseActionsRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a restaurant id."
  );
  assert.throws(
    () =>
      createPreparedAction({
        restaurantId: emSpacePadded,
        actionType: "create_internal_task",
        idempotencyKey: "task:safe"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a restaurant id."
  );
});

test("ASCII Mise-actions restaurant canonicalize rejects empty, control, and over-long tokens", () => {
  assert.equal(canonicalizeMiseActionsRestaurantId("   "), null);
  assert.equal(canonicalizeMiseActionsRestaurantId(`\u0000${workspace}`), null);
  assert.equal(canonicalizeMiseActionsRestaurantId("a".repeat(129)), null);
  assert.throws(
    () => requireCanonicalMiseActionsRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Mise actions require a restaurant id."
  );
  assert.throws(
    () => requireCanonicalMiseActionsOutcomeRestaurantId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Outcomes require a restaurant id."
  );
  assert.throws(
    () => requireCanonicalMiseActionsWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
