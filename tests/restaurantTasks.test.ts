import assert from "node:assert/strict";
import test from "node:test";

import {
  canRestaurantRoleCompleteSharedTask,
  completeRestaurantTaskRpcArguments,
  createRestaurantTaskRpcArguments,
  assertStructuredVerificationEvidence,
  buildCountSessionCompletionEvidence,
  normalizeCompleteRestaurantTaskInput,
  normalizeCreateRestaurantTaskInput,
  operationalTodayTaskFromRestaurantTask,
  restaurantTaskMatchesCreateRequest,
  restaurantTaskFromPersistedRow,
  visibleRestaurantTasksForToday,
  type PersistedRestaurantTaskRow
} from "../services/domain/restaurantTasks";

const row: PersistedRestaurantTaskRow = {
  id: "task-1",
  restaurant_id: "restaurant-a",
  location_id: null,
  origin: "human",
  title: "Confirm chicken count",
  detail: "Count the walk-in case.",
  operational_category: "inventory",
  priority: "urgent",
  status: "waiting",
  timing_bucket: "now",
  due_at: "2026-08-02T19:30:00.000Z",
  service_window: "before_supplier_cutoff",
  window_start: null,
  window_end: null,
  required_role: "member",
  assignee_user_id: "staff-1",
  verification_method: "count",
  verification_required: true,
  checklist: [{ label: "Record physical count" }],
  completion_result: null,
  completion_evidence: [],
  completed_at: null,
  completed_by: null,
  related_inventory_item_id: "item-1",
  related_order_id: null,
  related_recommendation_id: "recommendation-1",
  related_supplier_name: "Regional Protein Co",
  source_reference: "inventory-risk:item-1",
  created_by: "manager-1",
  client_task_id: "client-task-1",
  correlation_id: "correlation-1",
  created_at: "2026-08-02T19:00:00.000Z",
  updated_at: "2026-08-02T19:00:00.000Z"
};

test("normalizes a structured shared task and preserves service-window context", () => {
  const task = restaurantTaskFromPersistedRow(row, ["prerequisite-1"]);
  assert.equal(task.restaurantId, "restaurant-a");
  assert.equal(task.serviceWindow, "before_supplier_cutoff");
  assert.equal(task.verificationRequired, true);
  assert.equal(task.checklist[0]?.type, "checklist_item");
  assert.deepEqual(task.dependencyIds, ["prerequisite-1"]);
});

test("create normalization bounds and deduplicates task dependencies", () => {
  const input = normalizeCreateRestaurantTaskInput({
    restaurantId: " restaurant-a ",
    clientTaskId: " client-task-1 ",
    title: "  Confirm   chicken count  ",
    serviceWindow: "custom",
    windowStart: "2026-08-02T19:00:00Z",
    windowEnd: "2026-08-02T19:30:00Z",
    verificationMethod: "count",
    checklist: [{ label: "Record physical count" }],
    dependencyIds: ["task-a", "task-a", "task-b"]
  });
  assert.equal(input.title, "Confirm chicken count");
  assert.equal(input.windowStart, "2026-08-02T19:00:00.000Z");
  assert.deepEqual(input.dependencyIds, ["task-a", "task-b"]);
  assert.equal(input.requiredRole, "member");
});

test("custom service windows require a valid bounded interval", () => {
  assert.throws(
    () => normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId: "task-1",
      title: "Count walk-in",
      serviceWindow: "custom"
    }),
    /custom task windows require/i
  );
  assert.throws(
    () => normalizeCreateRestaurantTaskInput({
      restaurantId: "restaurant-a",
      clientTaskId: "task-1",
      title: "Count walk-in",
      windowStart: "2026-08-02T20:00:00Z",
      windowEnd: "2026-08-02T19:00:00Z"
    }),
    /end must be after/i
  );
});

test("completed persisted tasks must carry a result and required evidence", () => {
  assert.throws(
    () => restaurantTaskFromPersistedRow({ ...row, status: "completed" }),
    /missing its result/i
  );
  assert.throws(
    () => restaurantTaskFromPersistedRow({
      ...row,
      status: "completed",
      completion_result: "Counted 18 lb",
      completed_at: "2026-08-02T19:12:00Z",
      completed_by: "staff-1"
    }),
    /missing verification evidence/i
  );
  const completed = restaurantTaskFromPersistedRow({
    ...row,
    status: "completed",
    completion_result: "Counted 18 lb",
    completion_evidence: [{ type: "count", quantity: 18, unit: "lb" }],
    completed_at: "2026-08-02T19:12:00Z",
    completed_by: "staff-1"
  });
  assert.equal(completed.completionResult, "Counted 18 lb");
});

test("RPC arguments stay explicit and server-shaped", () => {
  const createArgs = createRestaurantTaskRpcArguments({
    restaurantId: "restaurant-a",
    clientTaskId: "client-task-1",
    title: "Confirm chicken count",
    origin: "verification",
    operationalCategory: "inventory",
    verificationMethod: "count",
    dependencyIds: ["task-a"]
  });
  assert.equal(createArgs.p_restaurant_id, "restaurant-a");
  assert.equal(createArgs.p_verification_method, "count");
  assert.deepEqual(createArgs.p_dependency_ids, ["task-a"]);

  const completion = normalizeCompleteRestaurantTaskInput({
    restaurantId: "restaurant-a",
    taskId: "task-1",
    completionResult: " Counted 18 lb ",
    completionEvidence: [{ type: "count", quantity: 18 }]
  });
  assert.equal(completion.completionResult, "Counted 18 lb");
  assert.equal(
    completeRestaurantTaskRpcArguments(completion).p_completion_evidence.length,
    1
  );
});

test("shared-task Today projection excludes cancelled work and respects completed visibility", () => {
  const waiting = restaurantTaskFromPersistedRow(row, ["prerequisite-1"]);
  const cancelled = { ...waiting, id: "task-cancelled", status: "cancelled" as const };
  const completed = {
    ...waiting,
    id: "task-completed",
    status: "completed" as const,
    completionResult: "Counted 18 lb",
    completionEvidence: [{ type: "count" }],
    completedAt: "2026-08-02T19:12:00.000Z",
    completedBy: "staff-1"
  };

  assert.deepEqual(
    visibleRestaurantTasksForToday([waiting, cancelled, completed]).map((task) => task.id),
    [waiting.id]
  );
  assert.deepEqual(
    visibleRestaurantTasksForToday([waiting, cancelled, completed], { includeCompleted: true })
      .map((task) => task.id),
    [waiting.id, completed.id]
  );

  const projected = operationalTodayTaskFromRestaurantTask(waiting);
  assert.equal(projected.source.kind, "restaurant_task");
  assert.equal(projected.action.intent, "open_restaurant_task");
  assert.equal(projected.action.route, `/tasks/${waiting.id}`);
  assert.equal(projected.status, "open");
});

test("create replay comparison is fail-closed and JSON key-order agnostic", () => {
  const task = restaurantTaskFromPersistedRow(row, ["prerequisite-1"]);
  const request = {
    restaurantId: "restaurant-a",
    clientTaskId: "client-task-1",
    title: "Confirm chicken count",
    detail: "Count the walk-in case.",
    origin: "human" as const,
    operationalCategory: "inventory" as const,
    priority: "urgent" as const,
    timingBucket: "now" as const,
    dueAt: "2026-08-02T19:30:00.000Z",
    serviceWindow: "before_supplier_cutoff" as const,
    requiredRole: "member" as const,
    assigneeUserId: "staff-1",
    verificationMethod: "count" as const,
    checklist: [{ label: "Record physical count", metadata: { unit: "lb", station: "walk-in" } }],
    relatedInventoryItemId: "item-1",
    relatedRecommendationId: "recommendation-1",
    relatedSupplierName: "Regional Protein Co",
    sourceReference: "inventory-risk:item-1",
    dependencyIds: ["prerequisite-1"]
  };
  const taskWithMetadata = {
    ...task,
    checklist: [{ metadata: { station: "walk-in", unit: "lb" }, label: "Record physical count", type: "checklist_item" }]
  };
  assert.equal(restaurantTaskMatchesCreateRequest(taskWithMetadata, request), true);
  assert.equal(
    restaurantTaskMatchesCreateRequest(taskWithMetadata, { ...request, priority: "high" }),
    false
  );
  assert.equal(
    restaurantTaskMatchesCreateRequest(taskWithMetadata, { ...request, dependencyIds: [] }),
    false
  );
});

test("count and receipt verification reject free-text-only evidence", () => {
  assert.throws(
    () => assertStructuredVerificationEvidence("count", [{ type: "count", note: "18 lb" }]),
    /submitted or approved inventory count session/i
  );
  assert.throws(
    () => assertStructuredVerificationEvidence("receipt", [{ type: "receipt", note: "PO-1" }]),
    /completed supplier order receipt/i
  );
  assert.doesNotThrow(() =>
    assertStructuredVerificationEvidence("count", [
      { type: "count_session", countSessionId: "session-1", status: "submitted" }
    ])
  );
  assert.throws(
    () =>
      assertStructuredVerificationEvidence(
        "receipt",
        [{ type: "supplier_receipt", supplierOrderId: "order-2" }],
        { relatedOrderId: "order-1" }
      ),
    /related supplier order/i
  );
});

test("count session completion evidence is structured and checklist-preserving", () => {
  const evidence = buildCountSessionCompletionEvidence({
    countSessionId: " session-1 ",
    status: "approved",
    note: " Walk-in verified ",
    checklist: [{ label: "Record physical count" }]
  });
  assert.equal(evidence[0]?.type, "checklist_item");
  assert.equal(evidence[1]?.type, "count_session");
  assert.equal(evidence[1]?.countSessionId, "session-1");
  assert.equal(evidence[1]?.status, "approved");
  assert.equal(evidence[1]?.note, "Walk-in verified");
});

test("shared task completion authorization gates non-assignee staff but permits manager override", () => {
  const task = { requiredRole: "member" as const, assigneeUserId: "staff-1" };
  assert.equal(canRestaurantRoleCompleteSharedTask("staff", "staff-1", task), true);
  assert.equal(canRestaurantRoleCompleteSharedTask("staff", "staff-2", task), false);
  assert.equal(canRestaurantRoleCompleteSharedTask("manager", "manager-1", task), true);
  assert.equal(
    canRestaurantRoleCompleteSharedTask("manager", "manager-1", {
      requiredRole: "owner_admin",
      assigneeUserId: null
    }),
    false
  );
});
