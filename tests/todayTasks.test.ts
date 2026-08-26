import assert from "node:assert/strict";
import test from "node:test";

import {
  canRestaurantRoleActOnTodayTask,
  classifyOperationalTodayTaskTiming,
  deriveOperationalTodayTasks,
  operationalTodayTaskId,
  sortOperationalTodayTasks,
  type OperationalTodayTask
} from "../services/domain/todayTasks";
import type {
  Insight,
  InventoryOutlookItem,
  PosIntegration,
  PurchaseRecommendation,
  SetupReadinessSummary,
  SupplierOrder
} from "../types/mise";

const restaurantId = "restaurant_a";
const otherRestaurantId = "restaurant_b";
const now = new Date("2026-07-19T03:30:00.000Z");

test("derives a stable, tenant-scoped operational queue without duplicating inventory risk", () => {
  const recommendations = [
    recommendation({ id: "rec_pending", inventory_item_id: "critical_item", status: "pending" }),
    recommendation({
      id: "rec_approved",
      inventory_item_id: "approved_item",
      item_name: "Olive oil",
      status: "approved",
      supplier_order_id: null
    }),
    recommendation({
      id: "rec_other_tenant",
      restaurant_id: otherRestaurantId,
      inventory_item_id: "foreign_item",
      status: "pending"
    })
  ];
  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [
      outlook("critical_item", "Critical"),
      outlook("watch_item", "Watch"),
      outlook("foreign_item", "Critical", otherRestaurantId)
    ],
    recommendations,
    orders: [order({ id: "draft_order", delivery_date: "2026-07-18" }), order({ id: "foreign_order", restaurant_id: otherRestaurantId })],
    setupReadiness: setupReadiness(),
    posIntegrations: [integration({ status: "error" }), integration({ id: "foreign_pos", restaurant_id: otherRestaurantId })],
    insights: [
      insight({ id: "sales_spike", insight_type: "sales", severity: "warning" }),
      insight({ id: "duplicate_inventory_signal", insight_type: "inventory", severity: "urgent" }),
      insight({ id: "foreign_insight", restaurant_id: otherRestaurantId, severity: "urgent" })
    ],
    now
  });

  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.restaurantId === restaurantId));
  assert.ok(tasks.every((task) => task.presentation), "every authoritative task has structured presentation metadata");
  assert.equal(tasks.some((task) => task.source.id === "foreign_item"), false);
  assert.equal(tasks.some((task) => task.source.id === "foreign_order"), false);
  assert.equal(tasks.some((task) => task.source.id === "foreign_pos"), false);
  assert.equal(tasks.some((task) => task.source.id === "foreign_insight"), false);

  const recommendationTask = tasks.find((task) => task.source.id === "rec_pending");
  assert.equal(recommendationTask?.action.intent, "review_recommendation");
  assert.equal(recommendationTask?.requiredRole, "manager");
  assert.equal(recommendationTask?.completion.canToggleDirectly, false);
  assert.equal(
    tasks.some((task) => task.source.kind === "inventory" && task.source.id === "critical_item"),
    false,
    "the pending recommendation is the authoritative action for this inventory risk"
  );

  const inventoryTask = tasks.find((task) => task.source.kind === "inventory" && task.source.id === "watch_item");
  assert.equal(inventoryTask, undefined, "stock-risk items route through the count session task instead of per-item shortcuts");

  const countSessionTask = tasks.find(
    (task) => task.source.kind === "inventory_count_session" && task.action.intent === "begin_inventory_count_session"
  );
  assert.equal(countSessionTask?.priority, "urgent");
  assert.equal(countSessionTask?.action.route, "/inventory/count");
  assert.equal(countSessionTask?.requiredRole, "member");

  const approvedTask = tasks.find((task) => task.action.intent === "prepare_supplier_draft");
  assert.equal(approvedTask?.source.id, "rec_approved");
  assert.equal(approvedTask?.status, "open");

  const draftTask = tasks.find((task) => task.source.id === "draft_order");
  assert.equal(draftTask?.dueDate, "2026-07-18");
  assert.equal(draftTask?.dueAt, null, "a delivery date must not be promoted to a fabricated exact time");
  assert.equal(draftTask?.action.route, "/orders/draft_order");

  assert.equal(tasks.some((task) => task.source.id === "duplicate_inventory_signal"), false);
  assert.equal(tasks.find((task) => task.source.id === "sales_spike")?.requiredRole, "member");

  const secondPass = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [outlook("critical_item", "Critical"), outlook("watch_item", "Watch")],
    recommendations: recommendations.slice(0, 2),
    orders: [order({ id: "draft_order", delivery_date: "2026-07-18" })],
    setupReadiness: setupReadiness(),
    posIntegrations: [integration({ status: "error" })],
    insights: [insight({ id: "sales_spike", insight_type: "sales", severity: "warning" })],
    now
  });
  assert.deepEqual(tasks.map((task) => task.id), secondPass.map((task) => task.id));
});

test("completed tasks are projections of changed source state and keep stable IDs", () => {
  const open = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [recommendation({ id: "rec_transition", status: "pending" })],
    orders: [order({ id: "order_transition", status: "draft" })],
    setupReadiness: setupReadiness(),
    posIntegrations: [integration({ id: "pos_transition", status: "error" })],
    insights: [],
    includeCompleted: true,
    now
  });
  const completed = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [recommendation({ id: "rec_transition", status: "dismissed" })],
    orders: [order({ id: "order_transition", status: "sent" })],
    setupReadiness: setupReadiness({ complete: true }),
    posIntegrations: [integration({ id: "pos_transition", status: "connected" })],
    insights: [],
    includeCompleted: true,
    now
  });

  for (const sourceId of ["rec_transition", "order_transition", "pos_transition", "profile"]) {
    const before = open.find((task) => task.source.id === sourceId);
    const after = completed.find((task) => task.source.id === sourceId);
    assert.ok(before, `expected open source ${sourceId}`);
    assert.ok(after, `expected completed source ${sourceId}`);
    assert.equal(after.id, before.id);
    assert.equal(after.status, "completed");
    assert.equal(after.completion.derivedFromSource, true);
    assert.equal(after.completion.canToggleDirectly, false);
  }

  const defaultQueue = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [recommendation({ id: "rec_transition", status: "dismissed" })],
    orders: [order({ id: "order_transition", status: "sent" })],
    setupReadiness: setupReadiness({ complete: true }),
    posIntegrations: [integration({ id: "pos_transition", status: "connected" })],
    insights: [],
    now
  });
  assert.deepEqual(defaultQueue, []);
});

test("classifies and sorts exact instants and local delivery dates in the restaurant timezone", () => {
  const options = { restaurantTimeZone: "America/New_York", now };
  const overdue = task("overdue", { dueAt: "2026-07-19T03:00:00.000Z", priority: "normal" });
  const dueSoon = task("due_soon", { dueAt: "2026-07-19T05:00:00.000Z" });
  const today = task("today", { dueDate: "2026-07-18" });
  const later = task("later", { dueDate: "2026-07-19", priority: "urgent" });
  const unscheduled = task("unscheduled");
  const completedOverdue = task("completed", { dueAt: "2026-07-18T03:00:00.000Z", status: "completed" });

  assert.equal(classifyOperationalTodayTaskTiming(overdue, options), "overdue");
  assert.equal(classifyOperationalTodayTaskTiming(dueSoon, options), "due_soon");
  assert.equal(classifyOperationalTodayTaskTiming(today, options), "today");
  assert.equal(classifyOperationalTodayTaskTiming(later, options), "later");
  assert.equal(classifyOperationalTodayTaskTiming(unscheduled, options), "unscheduled");

  const sorted = sortOperationalTodayTasks(
    [unscheduled, later, completedOverdue, today, dueSoon, overdue],
    options
  );
  assert.deepEqual(sorted.map((entry) => entry.source.id), ["overdue", "due_soon", "today", "later", "unscheduled", "completed"]);

  assert.equal(
    classifyOperationalTodayTaskTiming(today, { restaurantTimeZone: "UTC", now }),
    "overdue",
    "the same date-only commitment is already past in UTC but still today in New York"
  );
  assert.equal(
    classifyOperationalTodayTaskTiming(today, { restaurantTimeZone: "Invalid/Timezone", now }),
    "overdue",
    "invalid timezones fall back deterministically to UTC"
  );
});

test("rejects non-UTC dueAt values and enforces action role tiers", () => {
  const offsetDeadline = task("offset", { dueAt: "2026-07-19T05:00:00-04:00" });
  assert.equal(
    classifyOperationalTodayTaskTiming(offsetDeadline, { restaurantTimeZone: "America/New_York", now }),
    "unscheduled"
  );

  const memberTask = task("member", { requiredRole: "member" });
  const managerTask = task("manager", { requiredRole: "manager" });
  const ownerTask = task("owner", { requiredRole: "owner_admin" });
  assert.equal(canRestaurantRoleActOnTodayTask("staff", memberTask), true);
  assert.equal(canRestaurantRoleActOnTodayTask("staff", managerTask), false);
  assert.equal(canRestaurantRoleActOnTodayTask("manager", managerTask), true);
  assert.equal(canRestaurantRoleActOnTodayTask("manager", ownerTask), false);
  assert.equal(canRestaurantRoleActOnTodayTask("admin", ownerTask), true);
  assert.equal(canRestaurantRoleActOnTodayTask("owner", ownerTask), true);
});

function recommendation(
  patch: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "critical_item",
    item_name: "Chicken breast",
    supplier_id: "10000000-0000-4000-8000-000000000014",
    supplier_name: "Fresh Foods",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Projected stock is below the reorder threshold.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-07-18T14:00:00.000Z",
    ...patch
  };
}

function outlook(
  id: string,
  projectedStatus: InventoryOutlookItem["prediction"]["projectedStatus"],
  outlookRestaurantId = restaurantId
): InventoryOutlookItem {
  return {
    item: {
      id,
      restaurant_id: outlookRestaurantId,
      item_name: id.replaceAll("_", " "),
      category: "Produce",
      unit: "lb",
      current_quantity: 2,
      par_level: 20,
      reorder_threshold: 5,
      estimated_unit_cost: 2,
      supplier_id: "10000000-0000-4000-8000-000000000014",
      supplier_name: "Fresh Foods",
      last_updated: "2026-07-18T14:00:00.000Z"
    },
    prediction: {
      averageDailyUsage: 3,
      historySampleDays: 14,
      historySource: "restaurant_history",
      todayDepletion: 2,
      projectedQuantity: projectedStatus === "Critical" ? 0 : 3,
      projectedStatus,
      daysCoverage: projectedStatus === "Critical" ? 0 : 1,
      coverageLabel: projectedStatus === "Critical" ? "May run out today" : "Count needs review",
      demandTrend: "normal",
      trendLabel: "Normal demand",
      suggestedOrderQuantity: 18,
      suggestedAction: projectedStatus === "Watch" ? "Update count before ordering" : "Order 18 lb",
      urgency: projectedStatus === "Critical" ? "high" : projectedStatus === "Low" ? "medium" : "low",
      basis: "Restaurant history",
      depletionCopy: "2 lb used today",
      confidenceCopy: "14 days of restaurant history",
      recommendationCopy: "Review current stock.",
      whyItMatters: "Stock may not cover service.",
      countEvidence: "verified_count",
      countedAt: "2026-07-18T14:00:00.000Z",
      countAgeHours: 4,
      countFreshness: "fresh",
      unattributedTodayDepletion: 0,
      isTemporallyAuthoritative: true
    }
  };
}

function order(patch: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order_1",
    restaurant_id: restaurantId,
    supplier_id: "10000000-0000-4000-8000-000000000014",
    supplier_name: "Fresh Foods",
    order_message: "Please prepare the approved items.",
    operator_note: null,
    status: "draft",
    delivery_date: null,
    created_at: "2026-07-18T15:00:00.000Z",
    ...patch
  };
}

function setupReadiness(options: { complete?: boolean } = {}): SetupReadinessSummary {
  const complete = options.complete ?? false;
  return {
    percent: complete ? 100 : 25,
    currentStep: complete ? "email" : "profile",
    steps: [
      {
        id: "profile",
        label: "Profile",
        detail: complete ? "Restaurant ready" : "Name and cadence",
        status: complete ? "complete" : "active",
        missing: complete ? [] : ["order cadence"]
      },
      {
        id: "inventory",
        label: "Inventory",
        detail: "Inventory ready",
        status: "complete",
        missing: []
      },
      {
        id: "recipes",
        label: "Recipes",
        detail: "Recipes ready",
        status: "complete",
        missing: []
      },
      {
        id: "email",
        label: "Email",
        detail: "Gmail ready",
        status: "complete",
        missing: []
      }
    ],
    missingInventory: [],
    missingRecipes: [],
    missingSuppliers: [],
    missingEmailSender: false,
    canShowSalesRhythm: true,
    canShowSupplierTrend: true,
    canShowRecipeCoverage: true,
    emailConnectionStatus: "connected"
  };
}

function integration(patch: Partial<PosIntegration> = {}): PosIntegration {
  return {
    id: "pos_1",
    restaurant_id: restaurantId,
    provider: "square",
    status: "connected",
    external_location_id: "location_1",
    last_sync_at: "2026-07-18T15:00:00.000Z",
    sync_cursor: null,
    planning_sync_status: "fresh",
    planning_synced_at: "2026-07-18T15:00:00.000Z",
    planning_sync_error_code: null,
    settings: {},
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-18T15:00:00.000Z",
    ...patch
  };
}

function insight(patch: Partial<Insight> = {}): Insight {
  return {
    id: "insight_1",
    restaurant_id: restaurantId,
    insight_type: "sales",
    title: "Demand is rising",
    description: "Sales are above the recent baseline.",
    why_it_matters: "Prep could fall behind.",
    recommended_action: "Review prep coverage before service.",
    severity: "warning",
    created_at: "2026-07-18T15:00:00.000Z",
    ...patch
  };
}

function task(
  sourceId: string,
  patch: Partial<OperationalTodayTask> = {}
): OperationalTodayTask {
  const action = patch.action ?? {
    intent: "review_insight" as const,
    label: "Review",
    route: "/insights" as const,
    entityId: sourceId
  };
  return {
    id: operationalTodayTaskId("insight", sourceId, action.intent),
    restaurantId,
    source: { kind: "insight", id: sourceId, status: "warning" },
    title: sourceId,
    detail: "Derived test task",
    priority: "high",
    dueAt: null,
    dueDate: null,
    action,
    requiredRole: "member",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Test source remains active."
    },
    ...patch
  };
}
