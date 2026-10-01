import assert from "node:assert/strict";
import test from "node:test";

import { fromSupplierOrderSent } from "../services/domain/activityEvents";
import {
  buildDailyOperatingPlan,
  currentServiceWindow,
  hourInTimeZone,
  resolveOperatingPlanItemActionRoute,
  type BuildDailyOperatingPlanInput
} from "../services/domain/operatingPlan";
import {
  deriveOperationalTodayTasks,
  operationalTodayTaskId,
  type OperationalTodayTask
} from "../services/domain/todayTasks";
import type { RestaurantTask } from "../services/domain/restaurantTasks";
import type {
  Insight,
  InventoryOutlookItem,
  PosIntegration,
  PurchaseRecommendation,
  SetupReadinessSummary,
  SupplierOrder
} from "../types/mise";

const restaurantId = "rest_plan";
const otherRestaurantId = "rest_other";
const now = new Date("2026-08-02T15:30:00.000Z"); // 11:30 AM America/New_York (EDT)
const operatingDate = "2026-08-02";
const timeZone = "America/New_York";

test("hour and current window respect restaurant timezone without fabricating coverage", () => {
  assert.equal(hourInTimeZone(now, timeZone), 11);
  assert.equal(currentServiceWindow(11), "before_lunch");
  assert.equal(currentServiceWindow(8), "before_prep");
  assert.equal(currentServiceWindow(16), "before_dinner");
  assert.equal(currentServiceWindow(19), "during_service");
  assert.equal(currentServiceWindow(22), "closing");
});

test("builds a tenant-scoped windowed plan with why, needed-by, effect, kind, and verification", () => {
  const recommendations = [
    recommendation({
      id: "rec_pending",
      inventory_item_id: "inv_critical",
      status: "pending",
      urgency: "high",
      reason: "Coverage drops below one service day."
    }),
    recommendation({
      id: "rec_foreign",
      restaurant_id: otherRestaurantId,
      inventory_item_id: "inv_foreign",
      status: "pending"
    })
  ];
  const orders = [
    order({ id: "order_today", delivery_date: operatingDate, status: "draft" }),
    order({ id: "order_foreign", restaurant_id: otherRestaurantId, delivery_date: operatingDate })
  ];
  const tasks = deriveTasks({ recommendations, orders });
  const plan = buildDailyOperatingPlan(baseInput({ tasks, recommendations, orders }));

  assert.equal(plan.restaurantId, restaurantId);
  assert.equal(plan.operatingDate, operatingDate);
  assert.ok(plan.items.length > 0);
  assert.ok(plan.items.every((item) => item.restaurantId === restaurantId));
  assert.equal(
    plan.items.some((item) => item.sourceTask?.source.id === "rec_foreign"),
    false
  );
  assert.equal(
    plan.items.some((item) => item.sourceTask?.source.id === "order_foreign"),
    false
  );

  const approval = plan.items.find((item) => item.sourceTask?.source.id === "rec_pending");
  assert.ok(approval);
  assert.equal(approval?.kind, "approval");
  assert.equal(approval?.why, "Coverage drops below one service day.");
  assert.equal(approval?.verificationMethod, "review");
  assert.equal(approval?.effect.includes("operator-approved"), true);
  assert.deepEqual(approval?.relatedRefs, [
    { type: "purchase_recommendation", id: "rec_pending" }
  ]);
  assert.equal(approval?.serviceWindow, "before_prep");
  assert.equal(approval?.bucket, "now");
  assert.equal(approval?.reprioritization?.code, "stock_risk");

  const send = plan.items.find((item) => item.sourceTask?.source.id === "order_today");
  assert.ok(send);
  assert.equal(send?.neededBy, operatingDate);
  assert.equal(send?.verificationMethod, "receipt");
  assert.equal(send?.bucket, "now");
  assert.equal(send?.reprioritization?.code, "delivery_due_today");
  assert.match(send?.reprioritization?.reason ?? "", /needed today/);

  assert.ok(plan.serviceWindows.some((window) => window.id === "before_prep"));
  assert.equal(
    plan.serviceWindows.find((window) => window.id === "before_prep")?.evidence,
    "AM"
  );
});

test("count session tasks expose inventory_count_session related refs", () => {
  const tasks = deriveTasks({
    recommendations: [],
    orders: []
  });
  const countSessionTask = tasks.find(
    (task) =>
      task.source.kind === "inventory_count_session" &&
      task.action.intent === "begin_inventory_count_session"
  );
  assert.ok(countSessionTask, "stock-risk outlooks should create a begin count-session task");

  const plan = buildDailyOperatingPlan(baseInput({ tasks }));
  const countItem = plan.items.find(
    (item) => item.sourceTask?.source.kind === "inventory_count_session"
  );
  assert.ok(countItem);
  assert.deepEqual(countItem?.relatedRefs, [
    { type: "inventory_count_session", id: countSessionTask!.source.id }
  ]);
});

test("attaches dependency ids only when evidenced by recommendation→draft→order links", () => {
  const recommendations = [
    recommendation({
      id: "rec_approved",
      inventory_item_id: "inv_oil",
      item_name: "Olive oil",
      status: "approved",
      supplier_order_id: "order_linked",
      urgency: "medium"
    })
  ];
  const orders = [order({ id: "order_linked", status: "draft", delivery_date: "2026-08-05" })];
  const tasks = deriveTasks({
    recommendations,
    orders,
    includeCompleted: true
  });
  const plan = buildDailyOperatingPlan(baseInput({ tasks, recommendations, orders }));

  const reviewId = operationalTodayTaskId("recommendation", "rec_approved", "review_recommendation");
  const prepareId = operationalTodayTaskId("recommendation", "rec_approved", "prepare_supplier_draft");
  const sendId = operationalTodayTaskId("order", "order_linked", "send_supplier_order");

  const prepare = plan.items.find((item) => item.id === prepareId);
  assert.ok(prepare);
  assert.deepEqual(prepare?.dependencyIds, [reviewId]);

  const send = plan.items.find((item) => item.id === sendId);
  assert.ok(send);
  assert.ok(send?.dependencyIds.includes(prepareId));
  assert.ok(send?.dependencyIds.includes(reviewId));
});

test("merges tenant-scoped shared tasks with roles, windows, dependencies, and truthful results", () => {
  const prerequisite = restaurantTask({
    id: "task_prerequisite",
    title: "Count walk-in chicken",
    operationalCategory: "inventory",
    priority: "urgent",
    timingBucket: "now",
    serviceWindow: "before_prep",
    verificationMethod: "count",
    verificationRequired: true,
    detail: "Record the walk-in count before prep begins."
  });
  const blocked = restaurantTask({
    id: "task_blocked",
    title: "Prepare chicken order",
    status: "blocked",
    timingBucket: "up_next",
    serviceWindow: "before_supplier_cutoff",
    requiredRole: "manager",
    dependencyIds: [prerequisite.id]
  });
  const completed = restaurantTask({
    id: "task_completed",
    title: "Verify opening line",
    status: "completed",
    timingBucket: "later",
    completionResult: "Opening line verified with the shift lead.",
    completionEvidence: [{ type: "manager_review", label: "Shift lead confirmed" }],
    completedAt: "2026-08-02T14:00:00.000Z",
    completedBy: "user_manager"
  });
  const foreign = restaurantTask({
    id: "task_foreign",
    restaurantId: otherRestaurantId,
    title: "Foreign task"
  });
  const cancelled = restaurantTask({
    id: "task_cancelled",
    title: "Cancelled shared task",
    status: "cancelled"
  });

  const plan = buildDailyOperatingPlan(
    baseInput({ centralTasks: [prerequisite, blocked, completed, cancelled, foreign] })
  );

  const projectedPrerequisite = plan.items.find((item) => item.id === prerequisite.id);
  assert.ok(projectedPrerequisite);
  assert.equal(projectedPrerequisite?.sourceTask, null);
  assert.equal(projectedPrerequisite?.sourceRestaurantTask?.id, prerequisite.id);
  assert.equal(projectedPrerequisite?.kind, "human_task");
  assert.equal(projectedPrerequisite?.serviceWindow, "before_prep");
  assert.equal(projectedPrerequisite?.requiredRole, "member");
  assert.equal(projectedPrerequisite?.verificationMethod, "count");
  assert.equal(projectedPrerequisite?.why, prerequisite.detail);

  const projectedBlocked = plan.items.find((item) => item.id === blocked.id);
  assert.equal(projectedBlocked?.bucket, "later");
  assert.equal(projectedBlocked?.serviceWindow, "before_supplier_cutoff");
  assert.equal(projectedBlocked?.requiredRole, "manager");
  assert.deepEqual(projectedBlocked?.dependencyIds, [prerequisite.id]);

  const projectedCompleted = plan.items.find((item) => item.id === completed.id);
  assert.equal(projectedCompleted?.bucket, "done");
  assert.equal(projectedCompleted?.completionResult, completed.completionResult);
  assert.equal(projectedCompleted?.status, "completed");
  assert.equal(plan.items.some((item) => item.id === cancelled.id), false);
  assert.equal(plan.items.some((item) => item.id === foreign.id), false);
});

test("resolves plan item action routes to workflow screens, not only task detail", () => {
  const recommendations = [
    recommendation({
      id: "rec_route",
      inventory_item_id: "inv_critical",
      status: "pending",
      urgency: "high"
    })
  ];
  const orders = [order({ id: "order_route", delivery_date: operatingDate, status: "draft" })];
  const tasks = deriveTasks({ recommendations, orders });
  const shared = restaurantTask({
    id: "task_shared_route",
    title: "Check walk-in",
    timingBucket: "now"
  });
  const plan = buildDailyOperatingPlan(
    baseInput({ tasks, recommendations, orders, centralTasks: [shared] })
  );

  const countItem = plan.items.find(
    (item) => item.sourceTask?.action.intent === "begin_inventory_count_session"
  );
  assert.ok(countItem);
  assert.equal(countItem?.sourceTask?.action.route, "/inventory/count");
  assert.equal(resolveOperatingPlanItemActionRoute(countItem!), "/inventory/count");
  assert.notEqual(resolveOperatingPlanItemActionRoute(countItem!), `/tasks/${countItem!.id}`);

  const orderItem = plan.items.find((item) => item.sourceTask?.source.id === "order_route");
  assert.ok(orderItem);
  assert.equal(resolveOperatingPlanItemActionRoute(orderItem!), "/orders/order_route");
  assert.notEqual(resolveOperatingPlanItemActionRoute(orderItem!), `/tasks/${orderItem!.id}`);

  const approvalItem = plan.items.find((item) => item.sourceTask?.source.id === "rec_route");
  assert.ok(approvalItem);
  assert.equal(resolveOperatingPlanItemActionRoute(approvalItem!), "/orders");
  assert.notEqual(resolveOperatingPlanItemActionRoute(approvalItem!), `/tasks/${approvalItem!.id}`);

  const sharedItem = plan.items.find((item) => item.id === shared.id);
  assert.ok(sharedItem);
  assert.equal(sharedItem?.sourceTask, null);
  assert.equal(resolveOperatingPlanItemActionRoute(sharedItem!), `/tasks/${shared.id}`);
});

test("completion results come from matching activity or source state, never invented prose", () => {
  const orders = [order({ id: "order_sent", status: "sent", delivery_date: "2026-08-01" })];
  const tasks = deriveTasks({ orders, includeCompleted: true });
  const sentTask = tasks.find((task) => task.source.id === "order_sent");
  assert.ok(sentTask);

  const sentOrder = order({
    id: "order_sent",
    status: "sent",
    delivery_date: "2026-08-01",
    created_at: "2026-08-01T12:00:00.000Z"
  });
  const activity = [fromSupplierOrderSent(sentOrder)];

  const plan = buildDailyOperatingPlan(
    baseInput({
      tasks,
      orders,
      activityEvents: activity
    })
  );
  const completed = plan.items.find((item) => item.id === sentTask?.id);
  assert.equal(completed?.kind, "completed");
  assert.equal(completed?.bucket, "done");
  assert.equal(completed?.serviceWindow, "closing");
  assert.ok(completed?.completionResult);
  assert.equal(completed?.completionResult, activity[0]?.summary);
  assert.equal(completed?.reprioritization, null);

  const withoutActivity = buildDailyOperatingPlan(baseInput({ tasks, orders, activityEvents: [] }));
  const fallback = withoutActivity.items.find((item) => item.id === sentTask?.id);
  assert.equal(fallback?.completionResult, sentTask?.completion.reason);
});

test("overdue delivery and provider failure move items into Now with explicit reasons", () => {
  const orders = [order({ id: "order_late", status: "draft", delivery_date: "2026-07-30" })];
  const tasks = deriveTasks({
    orders,
    posIntegrations: [integration({ status: "error" })]
  });
  const plan = buildDailyOperatingPlan(baseInput({ tasks, orders }));

  const lateDraft = plan.items.find((item) => item.sourceTask?.source.id === "order_late");
  assert.ok(lateDraft);
  assert.equal(lateDraft?.bucket, "now");
  assert.equal(lateDraft?.reprioritization?.code, "delivery_overdue");

  const provider = plan.items.find((item) => item.sourceTask?.source.kind === "integration");
  assert.ok(provider);
  assert.equal(provider?.kind, "failed");
  assert.equal(provider?.bucket, "now");
  assert.equal(provider?.reprioritization?.code, "provider_failure");
  assert.equal(provider?.verificationMethod, "provider_sync");
});

test("due-soon deadlines reprioritize without inventing supplier cutoff clocks", () => {
  const dueAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const task = manualTask({
    id: "today:recommendation:rec_due:review_recommendation",
    dueAt,
    priority: "normal",
    source: { kind: "recommendation", id: "rec_due", status: "pending" },
    action: {
      intent: "review_recommendation",
      label: "Review",
      route: "/orders",
      entityId: "rec_due"
    }
  });
  const plan = buildDailyOperatingPlan(baseInput({ tasks: [task] }));
  const item = plan.items[0];
  assert.equal(item?.bucket, "now");
  assert.equal(item?.reprioritization?.code, "due_soon");
  assert.equal(item?.neededBy, dueAt);
});

test("rejects missing restaurant and invalid operating date", () => {
  assert.throws(
    () => buildDailyOperatingPlan(baseInput({ restaurantId: "  ", tasks: [] })),
    /restaurant/i
  );
  assert.throws(
    () => buildDailyOperatingPlan(baseInput({ operatingDate: "08/02/2026", tasks: [] })),
    /operating date/i
  );
});

function baseInput(
  overrides: Partial<BuildDailyOperatingPlanInput> & {
    tasks?: OperationalTodayTask[];
  } = {}
): BuildDailyOperatingPlanInput {
  return {
    restaurantId,
    restaurantTimeZone: timeZone,
    operatingDate,
    prepWindows: ["AM", "Dinner"],
    tasks: overrides.tasks ?? [],
    orders: overrides.orders ?? [],
    recommendations: overrides.recommendations ?? [],
    activityEvents: overrides.activityEvents ?? [],
    now,
    ...overrides
  };
}

function deriveTasks(input: {
  recommendations?: PurchaseRecommendation[];
  orders?: SupplierOrder[];
  posIntegrations?: PosIntegration[];
  includeCompleted?: boolean;
}) {
  return deriveOperationalTodayTasks({
    restaurantId,
    restaurantTimeZone: timeZone,
    inventoryOutlooks: [outlook("inv_watch", "Watch")],
    recommendations: input.recommendations ?? [],
    orders: input.orders ?? [],
    setupReadiness: setupReadiness(),
    posIntegrations: input.posIntegrations,
    insights: [insight({ id: "sales_spike", insight_type: "sales", severity: "warning" })],
    now,
    includeCompleted: input.includeCompleted
  });
}

function manualTask(overrides: Partial<OperationalTodayTask> = {}): OperationalTodayTask {
  return {
    id: "today:recommendation:rec_x:review_recommendation",
    restaurantId,
    source: { kind: "recommendation", id: "rec_x", status: "pending" },
    title: "Review reorder",
    detail: "Pending operator review.",
    priority: "normal",
    dueAt: null,
    dueDate: null,
    action: {
      intent: "review_recommendation",
      label: "Review recommendation",
      route: "/orders",
      entityId: "rec_x"
    },
    requiredRole: "manager",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "Recommendation remains pending operator review."
    },
    ...overrides
  };
}

function restaurantTask(overrides: Partial<RestaurantTask> = {}): RestaurantTask {
  return {
    id: "task_1",
    restaurantId,
    locationId: null,
    origin: "human",
    title: "Shared task",
    detail: null,
    operationalCategory: "other",
    priority: "normal",
    status: "waiting",
    timingBucket: "later",
    dueAt: null,
    serviceWindow: null,
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
    createdBy: "user_manager",
    clientTaskId: "client_task_1",
    correlationId: "correlation_task_1",
    dependencyIds: [],
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    ...overrides
  };
}

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec_1",
    restaurant_id: restaurantId,
    inventory_item_id: "inv_1",
    item_name: "Chicken thighs",
    supplier_id: "10000000-0000-4000-8000-000000000011",
    supplier_name: "Metro Produce",
    recommended_quantity: 18,
    unit: "lb",
    reason: "Mapped POS demand exceeds coverage.",
    urgency: "medium",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order_1",
    restaurant_id: restaurantId,
    supplier_id: "10000000-0000-4000-8000-000000000011",
    supplier_name: "Metro Produce",
    order_message: "Please deliver chicken.",
    operator_note: null,
    status: "draft",
    delivery_date: null,
    created_at: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}

function outlook(
  itemId: string,
  projectedStatus: "Watch" | "Low" | "Critical" | "Good",
  scopedRestaurantId = restaurantId
): InventoryOutlookItem {
  return {
    item: {
      id: itemId,
      restaurant_id: scopedRestaurantId,
      item_name: itemId,
      category: "Protein",
      unit: "lb",
      current_quantity: 8,
      par_level: 40,
      reorder_threshold: 18,
      estimated_unit_cost: 3.5,
      supplier_id: "10000000-0000-4000-8000-000000000011",
      supplier_name: "Metro Produce",
      last_updated: "2026-08-02T11:00:00.000Z"
    },
    prediction: {
      averageDailyUsage: 10,
      historySampleDays: 14,
      historySource: "restaurant_history",
      todayDepletion: 4,
      projectedQuantity: 4,
      projectedStatus,
      daysCoverage: 0.4,
      coverageLabel: "Under 1 service day of coverage",
      demandTrend: "rising",
      trendLabel: "Rising",
      suggestedOrderQuantity: 12,
      suggestedAction: "Order 12 lb",
      urgency: "high",
      basis: "Mapped POS demand",
      depletionCopy: "Likely to run out during dinner",
      confidenceCopy: "Based on 14 service days",
      recommendationCopy: "Approve reorder before cutoff",
      whyItMatters: "Usage is above forecast.",
      countEvidence: "verified_count",
      countedAt: "2026-08-02T11:00:00.000Z",
      countAgeHours: 4,
      countFreshness: "fresh",
      unattributedTodayDepletion: 0,
      isTemporallyAuthoritative: true
    }
  };
}

function setupReadiness(): SetupReadinessSummary {
  return {
    percent: 100,
    currentStep: "email",
    steps: [
      {
        id: "profile",
        label: "Profile",
        status: "complete",
        detail: "Complete",
        missing: []
      },
      {
        id: "inventory",
        label: "Inventory",
        status: "complete",
        detail: "Complete",
        missing: []
      },
      {
        id: "recipes",
        label: "Recipes",
        status: "complete",
        detail: "Complete",
        missing: []
      },
      {
        id: "email",
        label: "Email",
        status: "complete",
        detail: "Complete",
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

function integration(overrides: Partial<PosIntegration> = {}): PosIntegration {
  return {
    id: "pos_1",
    restaurant_id: restaurantId,
    provider: "square",
    status: "connected",
    external_location_id: "loc_1",
    last_sync_at: "2026-08-02T12:00:00.000Z",
    sync_cursor: null,
    settings: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-08-02T12:00:00.000Z",
    ...overrides
  };
}

function insight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "insight_1",
    restaurant_id: restaurantId,
    insight_type: "sales",
    title: "Sales spike",
    description: "Dinner covers are up.",
    recommended_action: "Confirm prep levels.",
    severity: "warning",
    created_at: "2026-08-02T10:00:00.000Z",
    ...overrides
  };
}
