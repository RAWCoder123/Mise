import assert from "node:assert/strict";
import test from "node:test";

import {
  canRestaurantRoleActOnTodayTask,
  classifyOperationalTodayTaskTiming,
  classifyTodayServicePulse,
  deriveOperationalTodayTasks,
  operationalTodayTaskId,
  prioritizeOperationalTodayTasksForRole,
  SUGGESTED_INVENTORY_COUNT_SESSION_SOURCE_ID,
  INCOMPATIBLE_RECIPE_UNITS_SOURCE_ID,
  UNMAPPED_POS_RECIPE_SOURCE_ID,
  sortOperationalTodayTasks,
  type OperationalTodayTask
} from "../services/domain/todayTasks";
import type {
  Insight,
  InventoryCountSession,
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

  assert.equal(
    tasks.some((task) => task.source.kind === "inventory" && task.source.id === "watch_item"),
    false,
    "stock-risk items route through the inventory count session instead of per-item shortcuts"
  );
  assert.equal(
    tasks.some((task) => task.action.intent === "begin_inventory_count_session"),
    true
  );

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

test("unmapped POS menu items create a recipe repair task and suppress duplicate setup recipes", () => {
  const incompleteRecipes = setupReadiness();
  incompleteRecipes.currentStep = "recipes";
  incompleteRecipes.steps = incompleteRecipes.steps.map((step) =>
    step.id === "recipes"
      ? {
          ...step,
          status: "active",
          missing: ["2 unmapped POS menu items"],
          detail: "Ingredient-per-dish links"
        }
      : step
  );

  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    setupReadiness: incompleteRecipes,
    unmappedPosMenuItems: [" Veggie Bowl ", "Veggie Bowl", "House Salad"],
    insights: [],
    now
  });

  const recipeTask = tasks.find((task) => task.source.kind === "recipe");
  assert.equal(recipeTask?.source.id, UNMAPPED_POS_RECIPE_SOURCE_ID);
  assert.equal(recipeTask?.action.intent, "map_unmapped_pos_items");
  assert.equal(recipeTask?.action.route, "/settings/recipes");
  assert.equal(recipeTask?.action.entityId, "House Salad");
  assert.equal(recipeTask?.requiredRole, "manager");
  assert.equal(recipeTask?.priority, "normal");
  assert.equal(recipeTask?.presentation?.code, "today.recipe.map_unmapped");
  if (recipeTask?.presentation?.code === "today.recipe.map_unmapped") {
    assert.equal(recipeTask.presentation.values.unmappedCount, 2);
    assert.equal(recipeTask.presentation.values.sampleItemName, "House Salad");
  }

  assert.equal(
    tasks.some((task) => task.source.kind === "setup" && task.source.id === "recipes"),
    false,
    "dedicated unmapped POS repair replaces the incomplete setup recipes step"
  );
});

test("incompatible recipe units create a distinct Today repair task", () => {
  const incompleteRecipes = setupReadiness();
  incompleteRecipes.currentStep = "recipes";
  incompleteRecipes.steps = incompleteRecipes.steps.map((step) =>
    step.id === "recipes"
      ? {
          ...step,
          status: "active",
          missing: ["1 incompatible recipe unit"],
          detail: "Ingredient-per-dish links"
        }
      : step
  );

  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "America/New_York",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    setupReadiness: incompleteRecipes,
    incompatibleRecipeMenuItems: ["Chicken Bowl", " Veggie Bowl ", "Chicken Bowl"],
    insights: [],
    now
  });

  const recipeTask = tasks.find((task) => task.source.id === INCOMPATIBLE_RECIPE_UNITS_SOURCE_ID);
  assert.equal(recipeTask?.action.intent, "repair_incompatible_recipe_units");
  assert.equal(recipeTask?.action.route, "/settings/recipes");
  assert.equal(recipeTask?.action.entityId, "Chicken Bowl");
  assert.equal(recipeTask?.requiredRole, "manager");
  assert.equal(recipeTask?.presentation?.code, "today.recipe.repair_incompatible_units");
  if (recipeTask?.presentation?.code === "today.recipe.repair_incompatible_units") {
    assert.equal(recipeTask.presentation.values.incompatibleCount, 2);
    assert.equal(recipeTask.presentation.values.sampleItemName, "Chicken Bowl");
  }

  assert.equal(
    tasks.some((task) => task.source.kind === "setup" && task.source.id === "recipes"),
    false,
    "dedicated incompatible-unit repair replaces the incomplete setup recipes step"
  );
});

test("open inventory count sessions become manager Today tasks", () => {
  const session: InventoryCountSession = {
    id: "count_session_1",
    restaurant_id: restaurantId,
    status: "submitted",
    started_by: "user_a",
    submitted_by: "user_a",
    approved_by: null,
    cancelled_by: null,
    started_at: "2026-07-31T01:00:00.000Z",
    submitted_at: "2026-07-31T02:00:00.000Z",
    approved_at: null,
    cancelled_at: null,
    note: null,
    created_at: "2026-07-31T01:00:00.000Z",
    updated_at: "2026-07-31T02:00:00.000Z"
  };
  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    openCountSession: session,
    now
  });
  const countTask = tasks.find((task) => task.source.kind === "inventory_count_session");
  assert.equal(countTask?.action.intent, "continue_inventory_count_session");
  assert.equal(countTask?.action.route, "/inventory/count");
  assert.equal(countTask?.requiredRole, "manager");
  assert.equal(countTask?.priority, "high");
  assert.equal(countTask?.status, "open");
});

test("in-progress inventory count sessions are visible to staff counters", () => {
  const session = {
    id: "count_session_in_progress",
    restaurant_id: restaurantId,
    status: "in_progress" as const,
    started_by: "user_staff",
    submitted_by: null,
    approved_by: null,
    cancelled_by: null,
    started_at: "2026-07-31T01:00:00.000Z",
    submitted_at: null,
    approved_at: null,
    cancelled_at: null,
    note: null,
    created_at: "2026-07-31T01:00:00.000Z",
    updated_at: "2026-07-31T01:30:00.000Z"
  };
  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [],
    insights: [],
    openCountSession: session,
    now
  });
  const countTask = tasks.find((task) => task.source.kind === "inventory_count_session");
  assert.equal(countTask?.requiredRole, "member");
  assert.equal(countTask?.priority, "normal");
  assert.equal(countTask?.presentation?.code, "today.inventory_count_session.continue");
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
    orders: [order({ id: "order_transition", status: "completed" })],
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

  const awaitingReceive = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [],
    orders: [order({ id: "order_transition", status: "sent" })],
    insights: [],
    now
  });
  assert.equal(awaitingReceive[0]?.action.intent, "receive_supplier_order");
  assert.equal(awaitingReceive[0]?.presentation?.code, "today.order.receive");
  assert.equal(awaitingReceive[0]?.status, "open");

  const defaultQueue = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [],
    recommendations: [recommendation({ id: "rec_transition", status: "dismissed" })],
    orders: [order({ id: "order_transition", status: "completed" })],
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

test("stock-risk without an open count session suggests a staff-startable count", () => {
  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [outlook("critical_item", "Critical"), outlook("watch_item", "Watch")],
    recommendations: [],
    orders: [],
    insights: [],
    openCountSession: null,
    now
  });
  const beginTask = tasks.find((entry) => entry.action.intent === "begin_inventory_count_session");
  assert.ok(beginTask);
  assert.equal(beginTask?.source.id, SUGGESTED_INVENTORY_COUNT_SESSION_SOURCE_ID);
  assert.equal(beginTask?.requiredRole, "member");
  assert.equal(beginTask?.priority, "urgent");
  assert.equal(beginTask?.action.route, "/inventory/count");
  assert.equal(beginTask?.presentation?.code, "today.inventory_count_session.begin");
  assert.equal(canRestaurantRoleActOnTodayTask("staff", beginTask!), true);
});

test("open count sessions suppress the suggested begin-count task", () => {
  const session: InventoryCountSession = {
    id: "count_session_open",
    restaurant_id: restaurantId,
    status: "in_progress",
    started_by: "user_staff",
    submitted_by: null,
    approved_by: null,
    cancelled_by: null,
    started_at: "2026-07-31T01:00:00.000Z",
    submitted_at: null,
    approved_at: null,
    cancelled_at: null,
    note: null,
    created_at: "2026-07-31T01:00:00.000Z",
    updated_at: "2026-07-31T01:30:00.000Z"
  };
  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [outlook("critical_item", "Critical")],
    recommendations: [],
    orders: [],
    insights: [],
    openCountSession: session,
    now
  });
  assert.equal(
    tasks.some((entry) => entry.action.intent === "begin_inventory_count_session"),
    false
  );
  assert.equal(
    tasks.some((entry) => entry.action.intent === "continue_inventory_count_session"),
    true
  );
  assert.equal(
    tasks.some((entry) => entry.action.intent === "update_inventory_count"),
    false
  );
});

test("stock-risk outlooks prefer count sessions over per-item inventory shortcuts", () => {
  const tasks = deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: "UTC",
    inventoryOutlooks: [
      outlook("critical_item", "Critical"),
      outlook("watch_item", "Watch")
    ],
    recommendations: [],
    orders: [],
    insights: [],
    openCountSession: null,
    now
  });
  assert.equal(
    tasks.some((entry) => entry.action.intent === "begin_inventory_count_session"),
    true
  );
  assert.equal(
    tasks.some((entry) => entry.action.intent === "update_inventory_count"),
    false
  );
});

test("role prioritization keeps staff-actionable work ahead of locked manager tasks", () => {
  const managerTask = task("manager_first", {
    requiredRole: "manager",
    priority: "urgent",
    dueAt: "2026-07-18T12:00:00.000Z"
  });
  const staffTask = task("staff_second", {
    requiredRole: "member",
    priority: "normal",
    dueAt: null
  });
  const sorted = sortOperationalTodayTasks([staffTask, managerTask], {
    restaurantTimeZone: "UTC",
    now
  });
  assert.equal(sorted[0]?.source.id, "manager_first");
  const forStaff = prioritizeOperationalTodayTasksForRole(sorted, "staff");
  assert.deepEqual(
    forStaff.map((entry) => entry.source.id),
    ["staff_second", "manager_first"]
  );
  const forManager = prioritizeOperationalTodayTasksForRole(sorted, "manager");
  assert.deepEqual(
    forManager.map((entry) => entry.source.id),
    ["manager_first", "staff_second"]
  );
});

function recommendation(
  patch: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "critical_item",
    item_name: "Chicken breast",
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
      whyItMatters: "Stock may not cover service."
    }
  };
}

function order(patch: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order_1",
    restaurant_id: restaurantId,
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

test("classifyTodayServicePulse keeps open operational tasks from claiming service is on track", () => {
  assert.deepEqual(
    classifyTodayServicePulse({
      inventoryHealth: { low: 0, critical: 2 },
      pendingRecommendations: 4,
      openOperationalTaskCount: 3
    }),
    { kind: "stock_risk", tone: "danger", count: 2 }
  );
  assert.deepEqual(
    classifyTodayServicePulse({
      inventoryHealth: { low: 1, critical: 0 },
      pendingRecommendations: 0,
      openOperationalTaskCount: 0
    }),
    { kind: "stock_risk", tone: "warning", count: 1 }
  );
  assert.deepEqual(
    classifyTodayServicePulse({
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 3,
      openOperationalTaskCount: 5
    }),
    { kind: "order_review", tone: "warning", count: 3 }
  );
  assert.deepEqual(
    classifyTodayServicePulse({
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0,
      openOperationalTaskCount: 2
    }),
    { kind: "open_tasks", tone: "warning", count: 2 }
  );
  assert.deepEqual(
    classifyTodayServicePulse({
      inventoryHealth: { low: 0, critical: 0 },
      pendingRecommendations: 0,
      openOperationalTaskCount: 0
    }),
    { kind: "ready", tone: "success", count: 0 }
  );
});

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
