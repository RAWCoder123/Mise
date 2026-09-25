import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  activityEventFromPersistedRow,
  activityEventToPersistedInsert,
  type ActivityEvent
} from "../services/domain/activityEvents";
import {
  actionOutcomeToPersistedRow,
  miseActionFromPersistedRow,
  miseActionToPersistedRow,
  type MiseAction,
  type Outcome
} from "../services/domain/miseActions";
import {
  autonomyRuleFromPersistedRow,
  autonomyRuleToPersistedRow,
  type RestaurantAutonomyRule
} from "../services/domain/restaurantAutonomy";
import {
  restaurantMemoryFromPersistedRow,
  restaurantMemoryToPersistedRow,
  type RestaurantMemory
} from "../services/domain/restaurantMemory";
import {
  restaurantTaskFromPersistedRow,
  restaurantTaskToPersistedRow,
  type RestaurantTask
} from "../services/domain/restaurantTasks";
import {
  recalculationRunFromPersistedRow,
  recalculationRunToPersistedRow
} from "../services/domain/recalculationRunTransport";
import type { PersistedRecalculationRun } from "../services/repositories/repositoryContracts";
import { DEMO_RESTAURANT_ID } from "../services/demoData";

function assertSnakeCaseRow(row: Record<string, unknown>, requiredKeys: readonly string[]) {
  for (const key of Object.keys(row)) {
    assert.doesNotMatch(key, /[a-z][A-Z]/, `unexpected camelCase export key: ${key}`);
  }
  for (const key of requiredKeys) {
    assert.ok(key in row, `missing required export key: ${key}`);
  }
  assert.equal("restaurantId" in row, false);
}

test("demo export ops datasets flatten through persisted row mappers", () => {
  const demo = readFileSync("services/repositories/demoRepository.ts", "utf8");
  assert.match(demo, /activityEventToPersistedInsert\(event\)/);
  assert.match(demo, /miseActionToPersistedRow\(action\)/);
  assert.match(demo, /actionOutcomeToPersistedRow\(outcome\)/);
  assert.match(demo, /restaurantMemoryToPersistedRow\(memory\)/);
  assert.match(demo, /autonomyRuleToPersistedRow\(rule\)/);
  assert.match(demo, /restaurantTaskToPersistedRow\(task\)/);
  assert.match(demo, /recalculationRunToPersistedRow\(run\)/);
  assert.doesNotMatch(
    demo,
    /datasets\.activity_events[\s\S]{0,200}\{\s*\.\.\.event,\s*restaurant_id:/
  );
  assert.doesNotMatch(
    demo,
    /datasets\.mise_actions[\s\S]{0,200}\{\s*\.\.\.action,\s*restaurant_id:/
  );
  assert.doesNotMatch(
    demo,
    /datasets\.restaurant_tasks[\s\S]{0,200}\{\s*\.\.\.task,\s*restaurant_id:/
  );
});

test("persisted ops mappers round-trip snake_case without camelCase keys", () => {
  const activity: ActivityEvent = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    restaurantId: DEMO_RESTAURANT_ID,
    locationId: null,
    occurredAt: "2026-09-25T12:00:00.000Z",
    createdAt: "2026-09-25T12:00:01.000Z",
    activityType: "inventory_count_recorded",
    category: "inventory",
    title: "Count recorded",
    summary: "Physical count submitted.",
    triggerType: "operator",
    triggerReference: null,
    evidenceReferences: [],
    sourceSystems: ["mise"],
    actionId: null,
    recommendationId: null,
    autonomyLevel: 2,
    confidence: 0.8,
    status: "completed",
    requiresAttention: false,
    attentionDeadline: null,
    relatedEntityType: null,
    relatedEntityId: null,
    parentActivityId: null,
    sequenceId: null,
    metadata: { idempotencyKey: "activity:count:1", source: "mise", actorType: "human" },
    errorCode: null,
    errorMessage: null,
    resolvedAt: null,
    resolvedBy: null
  };
  const activityRow = activityEventToPersistedInsert(activity);
  assertSnakeCaseRow(activityRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "event_type",
    "occurred_at",
    "recorded_at",
    "idempotency_key"
  ]);
  assert.equal(activityEventFromPersistedRow(activityRow).activityType, "inventory_count_recorded");

  const action: MiseAction = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    restaurantId: DEMO_RESTAURANT_ID,
    recommendationId: null,
    actionType: "send_supplier_order",
    executionMode: "execute",
    status: "executed",
    autonomyLevel: 3,
    requestedBy: "actor-1",
    approvedBy: "actor-1",
    executedAt: "2026-09-25T12:05:00.000Z",
    result: { orderId: "order-1" },
    error: null,
    rollbackReference: null,
    expectedImpact: { deliveryStatus: "received" },
    financialImpactCents: 1200,
    idempotencyKey: "send:order-1",
    createdAt: "2026-09-25T12:01:00.000Z",
    updatedAt: "2026-09-25T12:05:00.000Z"
  };
  const actionRow = miseActionToPersistedRow(action);
  assertSnakeCaseRow(actionRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "action_type",
    "execution_mode",
    "error_message",
    "financial_impact_cents",
    "idempotency_key"
  ]);
  assert.equal(miseActionFromPersistedRow(actionRow).actionType, "send_supplier_order");

  const outcome: Outcome = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    actionId: action.id,
    restaurantId: DEMO_RESTAURANT_ID,
    expectedResult: { deliveryStatus: "received" },
    actualResult: { deliveryStatus: "received", deliveryId: "delivery-1" },
    variance: {},
    measuredAt: "2026-09-25T12:10:00.000Z",
    lesson: "Received as expected."
  };
  const outcomeRow = actionOutcomeToPersistedRow(outcome);
  assertSnakeCaseRow(outcomeRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "action_id",
    "expected_result",
    "actual_result",
    "measured_at",
    "idempotency_key",
    "created_at"
  ]);
  assert.equal(outcomeRow.idempotency_key, "supplier_delivery_outcome:delivery-1");
  assert.equal("restaurantId" in outcomeRow, false);
  assert.equal("actionId" in outcomeRow, false);

  const memory: RestaurantMemory = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    restaurantId: DEMO_RESTAURANT_ID,
    memoryType: "demand_pattern",
    statement: "Friday dinner pulls more produce.",
    evidence: [{ type: "pos_sale_window", id: "e1", summary: "spike", observedAt: "2026-09-25T12:00:00.000Z" }],
    confidence: 0.7,
    firstObservedAt: "2026-09-25T12:00:00.000Z",
    lastUpdatedAt: "2026-09-25T12:00:00.000Z",
    scope: "restaurant",
    source: "mise_learning",
    status: "active",
    affectsRecommendations: true,
    affectsAutomation: false,
    correctionNote: null
  };
  const memoryRow = restaurantMemoryToPersistedRow(memory);
  assertSnakeCaseRow(memoryRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "memory_type",
    "first_observed_at",
    "last_updated_at",
    "affects_recommendations"
  ]);
  assert.equal(restaurantMemoryFromPersistedRow(memoryRow).memoryType, "demand_pattern");

  const rule: RestaurantAutonomyRule = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
    restaurantId: DEMO_RESTAURANT_ID,
    locationId: null,
    actionType: "prepare_supplier_order_draft",
    operationalCategory: "orders",
    maximumAutonomyLevel: 3,
    requiresApproval: true,
    enabled: true,
    spendLimitCents: 50000,
    supplierId: null,
    supplierName: null,
    communicationType: null,
    allowedStartTime: null,
    allowedEndTime: null,
    createdAt: "2026-09-25T12:00:00.000Z",
    updatedAt: "2026-09-25T12:00:00.000Z"
  };
  const ruleRow = autonomyRuleToPersistedRow(rule);
  assertSnakeCaseRow(ruleRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "action_type",
    "operational_category",
    "maximum_autonomy_level",
    "requires_approval",
    "spend_limit_cents"
  ]);
  assert.equal(autonomyRuleFromPersistedRow(ruleRow).actionType, "prepare_supplier_order_draft");

  const task: RestaurantTask = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
    restaurantId: DEMO_RESTAURANT_ID,
    locationId: null,
    origin: "human",
    title: "Count produce",
    detail: "Before lunch",
    operationalCategory: "inventory",
    priority: "high",
    status: "waiting",
    timingBucket: "now",
    dueAt: null,
    serviceWindow: "before_lunch",
    windowStart: null,
    windowEnd: null,
    requiredRole: "member",
    assigneeUserId: null,
    verificationMethod: "none",
    verificationRequired: false,
    checklist: [],
    completionResult: null,
    completionEvidence: [],
    completedAt: null,
    completedBy: null,
    relatedInventoryItemId: null,
    relatedOrderId: null,
    relatedRecommendationId: null,
    relatedSupplierName: null,
    sourceReference: null,
    createdBy: "actor-1",
    clientTaskId: "client-task-1",
    correlationId: "corr-1",
    dependencyIds: [],
    createdAt: "2026-09-25T12:00:00.000Z",
    updatedAt: "2026-09-25T12:00:00.000Z"
  };
  const taskRow = restaurantTaskToPersistedRow(task);
  assertSnakeCaseRow(taskRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "operational_category",
    "timing_bucket",
    "service_window",
    "verification_method",
    "verification_required",
    "client_task_id",
    "correlation_id"
  ]);
  assert.equal(restaurantTaskFromPersistedRow(taskRow).title, "Count produce");

  const run: PersistedRecalculationRun = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
    restaurantId: DEMO_RESTAURANT_ID,
    cycle: "daily_open",
    operatingDate: "2026-09-25",
    status: "succeeded",
    attempt: 1,
    jobName: "daily_open",
    monitoringOwner: "manager",
    startedAt: "2026-09-25T08:00:00.000Z",
    completedAt: "2026-09-25T08:00:05.000Z",
    durationMs: 5000,
    timedOut: false,
    failureReason: null,
    cycleKey: "daily_open:2026-09-25",
    idempotencyKey: "daily_open:2026-09-25:attempt-1",
    recordedBy: "actor-1",
    correlationId: "corr-run-1",
    recordedAt: "2026-09-25T08:00:05.000Z"
  };
  const runRow = recalculationRunToPersistedRow(run);
  assertSnakeCaseRow(runRow as unknown as Record<string, unknown>, [
    "restaurant_id",
    "operating_date",
    "job_name",
    "monitoring_owner",
    "started_at",
    "completed_at",
    "duration_ms",
    "timed_out",
    "failure_reason",
    "cycle_key",
    "idempotency_key",
    "recorded_by",
    "correlation_id",
    "recorded_at"
  ]);
  assert.equal(recalculationRunFromPersistedRow(runRow).cycle, "daily_open");
});

test("demo restaurant export emits snake_case activity and task rows", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); },
      clear: () => { values.clear(); },
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  await repository.createRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    clientTaskId: `export-shape-task-${Date.now()}`,
    title: "Export shape pin",
    detail: "Ensure demo export uses hosted column names.",
    operationalCategory: "inventory",
    priority: "normal",
    timingBucket: "now",
    serviceWindow: "before_lunch",
    requiredRole: "member",
    verificationMethod: "none"
  });

  const exported = await repository.exportRestaurantData(DEMO_RESTAURANT_ID);
  assert.ok(exported.datasets.activity_events.length > 0);
  assert.ok(exported.datasets.restaurant_tasks.length > 0);
  assert.ok(exported.datasets.restaurant_autonomy_rules.length > 0);

  const activity = exported.datasets.activity_events[0] as Record<string, unknown>;
  assert.equal(typeof activity.event_type, "string");
  assert.equal(typeof activity.occurred_at, "string");
  assert.equal(typeof activity.recorded_at, "string");
  assert.equal(typeof activity.restaurant_id, "string");
  assert.equal("activityType" in activity, false);
  assert.equal("occurredAt" in activity, false);
  assert.equal("restaurantId" in activity, false);

  const task = exported.datasets.restaurant_tasks.find(
    (row) => (row as { title?: string }).title === "Export shape pin"
  ) as Record<string, unknown>;
  assert.ok(task);
  assert.equal(task.restaurant_id, DEMO_RESTAURANT_ID);
  assert.equal(task.operational_category, "inventory");
  assert.equal(task.service_window, "before_lunch");
  assert.equal(task.timing_bucket, "now");
  assert.equal(typeof task.client_task_id, "string");
  assert.equal(String(task.client_task_id).startsWith("export-shape-task-"), true);
  assert.equal("operationalCategory" in task, false);
  assert.equal("serviceWindow" in task, false);
  assert.equal("restaurantId" in task, false);

  const rule = exported.datasets.restaurant_autonomy_rules[0] as Record<string, unknown>;
  assert.equal(typeof rule.action_type, "string");
  assert.equal(typeof rule.maximum_autonomy_level, "number");
  assert.equal("actionType" in rule, false);
  assert.equal("maximumAutonomyLevel" in rule, false);

  if (exported.datasets.mise_actions.length > 0) {
    const action = exported.datasets.mise_actions[0] as Record<string, unknown>;
    assert.equal(typeof action.action_type, "string");
    assert.equal("actionType" in action, false);
  }
  if (exported.datasets.action_outcomes.length > 0) {
    const outcome = exported.datasets.action_outcomes[0] as Record<string, unknown>;
    assert.equal(typeof outcome.action_id, "string");
    assert.equal(typeof outcome.measured_at, "string");
    assert.equal(typeof outcome.idempotency_key, "string");
    assert.equal("actionId" in outcome, false);
    assert.equal("measuredAt" in outcome, false);
  }
  if (exported.datasets.restaurant_memories.length > 0) {
    const memory = exported.datasets.restaurant_memories[0] as Record<string, unknown>;
    assert.equal(typeof memory.memory_type, "string");
    assert.equal(typeof memory.first_observed_at, "string");
    assert.equal("memoryType" in memory, false);
    assert.equal("firstObservedAt" in memory, false);
  }
});
