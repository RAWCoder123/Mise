import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOperatingRoutineDrafts,
  listOperatingRoutines,
  operatingRoutineClientTaskId,
  planOperatingRoutineMaterialization
} from "../services/domain/operatingRoutines";
import type { RestaurantTask } from "../services/domain/restaurantTasks";

function taskStub(
  overrides: Partial<RestaurantTask> & Pick<RestaurantTask, "clientTaskId" | "restaurantId">
): RestaurantTask {
  const base: RestaurantTask = {
    id: "task-1",
    restaurantId: overrides.restaurantId,
    locationId: null,
    origin: "mise",
    title: "Existing",
    detail: null,
    operationalCategory: "cleaning",
    priority: "normal",
    status: "waiting",
    timingBucket: "now",
    dueAt: null,
    serviceWindow: "before_prep",
    windowStart: null,
    windowEnd: null,
    requiredRole: "member",
    assigneeUserId: null,
    verificationMethod: "checklist",
    verificationRequired: true,
    checklist: [],
    completionResult: null,
    completionEvidence: [],
    completedAt: null,
    completedBy: null,
    relatedInventoryItemId: null,
    relatedOrderId: null,
    relatedRecommendationId: null,
    relatedSupplierName: null,
    sourceReference: overrides.sourceReference ?? overrides.clientTaskId,
    createdBy: "user-1",
    clientTaskId: overrides.clientTaskId,
    correlationId: "corr-1",
    dependencyIds: [],
    createdAt: "2026-09-02T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z"
  };
  return { ...base, ...overrides, clientTaskId: overrides.clientTaskId };
}

test("operating routines expose opening, closing, and food safety templates", () => {
  const routines = listOperatingRoutines();
  assert.deepEqual(
    routines.map((routine) => routine.id),
    ["opening", "closing", "food_safety"]
  );
  for (const routine of routines) {
    assert.ok(routine.steps.length >= 3);
    for (const step of routine.steps) {
      assert.ok(step.checklist.length >= 2);
      assert.notEqual(step.verificationMethod, "none");
    }
  }
});

test("routine drafts are deterministic and day-scoped for idempotent create", () => {
  const drafts = buildOperatingRoutineDrafts({
    restaurantId: "rest-1",
    routineId: "opening",
    operatingDate: "2026-09-02"
  });
  assert.equal(drafts.length, 3);
  assert.equal(
    drafts[0]?.clientTaskId,
    operatingRoutineClientTaskId("opening", "walk_in_temps", "2026-09-02")
  );
  assert.equal(drafts[0]?.origin, "mise");
  assert.equal(drafts[0]?.sourceReference, drafts[0]?.clientTaskId);
  assert.equal(
    buildOperatingRoutineDrafts({
      restaurantId: "rest-1",
      routineId: "opening",
      operatingDate: "2026-09-02"
    })[1]?.clientTaskId,
    drafts[1]?.clientTaskId
  );
});

test("materialization plans skip client task ids already present for the day", () => {
  const existingId = operatingRoutineClientTaskId("closing", "log_waste", "2026-09-02");
  const plan = planOperatingRoutineMaterialization({
    restaurantId: "rest-1",
    routineId: "closing",
    operatingDate: "2026-09-02",
    existingTasks: [taskStub({ restaurantId: "rest-1", clientTaskId: existingId })]
  });
  assert.equal(plan.alreadyPresent.length, 1);
  assert.equal(plan.alreadyPresent[0]?.stepKey, "log_waste");
  assert.equal(plan.create.length, 2);
  assert.ok(plan.create.every((draft) => draft.clientTaskId !== existingId));
});

test("materialization fails closed on cross-tenant existing tasks", () => {
  assert.throws(
    () =>
      planOperatingRoutineMaterialization({
        restaurantId: "rest-1",
        routineId: "food_safety",
        operatingDate: "2026-09-02",
        existingTasks: [taskStub({ restaurantId: "other", clientTaskId: "x" })]
      }),
    /restaurant scope validation/i
  );
});

test("operating date must be calendar-shaped", () => {
  assert.throws(
    () =>
      buildOperatingRoutineDrafts({
        restaurantId: "rest-1",
        routineId: "opening",
        operatingDate: "09/02/2026"
      }),
    /YYYY-MM-DD/
  );
});
