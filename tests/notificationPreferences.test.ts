import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  filterOperatingPlanByNotificationPreferences,
  filterOperationalTodayTasksByNotificationPreferences,
  normalizeNotificationPreferences,
  notificationCategoryForOperatingPlanItem,
  notificationCategoryForTodayTask,
  toggleNotificationCategory,
  type OperatorNotificationPreferences
} from "../services/domain/notificationPreferences";
import type { DailyOperatingPlan, OperatingPlanItem } from "../services/domain/operatingPlan";
import type { OperationalTodayTask } from "../services/domain/todayTasks";

function task(partial: {
  id: string;
  code: string;
  sourceKind?: OperationalTodayTask["source"]["kind"];
}): OperationalTodayTask {
  return {
    id: partial.id,
    restaurantId: "restaurant_a",
    source: {
      kind: partial.sourceKind ?? "insight",
      id: partial.id,
      status: "open"
    },
    title: partial.id,
    detail: partial.id,
    presentation: {
      code: partial.code as NonNullable<OperationalTodayTask["presentation"]>["code"],
      values: {} as never
    },
    priority: "normal",
    dueAt: null,
    dueDate: null,
    action: {
      intent: "review_insight",
      label: "Review",
      route: "/insights",
      entityId: null
    },
    requiredRole: "manager",
    status: "open",
    completion: {
      derivedFromSource: true,
      canToggleDirectly: false,
      reason: "open"
    }
  };
}

function planItem(
  partial: {
    id: string;
    sourceTask?: OperationalTodayTask | null;
    kind?: OperatingPlanItem["kind"];
    bucket?: OperatingPlanItem["bucket"];
  }
): OperatingPlanItem {
  return {
    id: partial.id,
    restaurantId: "restaurant_a",
    kind: partial.kind ?? "mise_task",
    title: partial.id,
    detail: partial.id,
    why: partial.id,
    neededBy: null,
    effect: partial.id,
    serviceWindow: "unscheduled",
    bucket: partial.bucket ?? "now",
    priority: "normal",
    relatedRefs: [],
    dependencyIds: [],
    verificationMethod: "none",
    completionResult: null,
    reprioritization: null,
    requiredRole: "member",
    status: "open",
    sourceTask: partial.sourceTask ?? null,
    sourceRestaurantTask: null
  };
}

test("normalizeNotificationPreferences fills defaults and drops unknown keys", () => {
  const normalized = normalizeNotificationPreferences({
    inventory: false,
    mystery: true,
    orders: "nope",
    waste: 1
  });

  assert.deepEqual(normalized, {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    inventory: false
  });
  assert.equal("mystery" in normalized, false);
  assert.equal(NOTIFICATION_CATEGORIES.includes("setup"), true);
});

test("notificationCategoryForTodayTask maps presentation families", () => {
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "count", code: "today.inventory_count_session.begin" })),
    "inventory"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "rec", code: "today.recommendation.review" })),
    "orders"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "order", code: "today.order.send" })),
    "orders"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "waste", code: "today.waste.chronic_waste" })),
    "waste"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "pos", code: "today.integration.connect" })),
    "recipes_pos"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "insight", code: "today.insight.review" })),
    "insights"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "setup", code: "today.setup.inventory.open" })),
    "setup"
  );
  assert.equal(
    notificationCategoryForTodayTask({
      presentation: undefined,
      source: { kind: "restaurant_task", id: "floor", status: "open" }
    }),
    null
  );
});

test("filterOperationalTodayTasksByNotificationPreferences hides muted categories only", () => {
  const muted: OperatorNotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    waste: false,
    insights: false
  };
  const tasks = [
    task({ id: "inventory", code: "today.inventory.resolve_stock" }),
    task({ id: "waste", code: "today.waste.chronic_waste" }),
    task({ id: "insight", code: "today.insight.review" }),
    task({ id: "orders", code: "today.recommendation.review" })
  ];

  const filtered = filterOperationalTodayTasksByNotificationPreferences(tasks, muted);
  assert.deepEqual(
    filtered.map((entry) => entry.id),
    ["inventory", "orders"]
  );
});

test("filterOperatingPlanByNotificationPreferences rebuilds buckets and keeps human tasks", () => {
  const muted: OperatorNotificationPreferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    recipes_pos: false,
    insights: false
  };
  const plan: DailyOperatingPlan = {
    restaurantId: "restaurant_a",
    operatingDate: "2026-08-27",
    restaurantTimeZone: "America/New_York",
    generatedAt: "2026-08-27T12:00:00.000Z",
    serviceWindows: [],
    items: [
      planItem({
        id: "pos",
        bucket: "now",
        sourceTask: task({ id: "pos", code: "today.integration.repair" })
      }),
      planItem({
        id: "insight",
        bucket: "up_next",
        sourceTask: task({ id: "insight", code: "today.insight.review" })
      }),
      planItem({
        id: "floor",
        bucket: "later",
        kind: "human_task",
        sourceTask: null
      })
    ],
    buckets: {
      now: [],
      up_next: [],
      later: [],
      done: []
    }
  };
  plan.buckets.now = [plan.items[0]!];
  plan.buckets.up_next = [plan.items[1]!];
  plan.buckets.later = [plan.items[2]!];

  assert.equal(notificationCategoryForOperatingPlanItem(plan.items[0]!), "recipes_pos");
  assert.equal(notificationCategoryForOperatingPlanItem(plan.items[2]!), null);

  const filtered = filterOperatingPlanByNotificationPreferences(plan, muted);
  assert.deepEqual(
    filtered.items.map((item) => item.id),
    ["floor"]
  );
  assert.deepEqual(
    filtered.buckets.later.map((item) => item.id),
    ["floor"]
  );
  assert.equal(filtered.buckets.now.length, 0);
  assert.equal(filtered.buckets.up_next.length, 0);
});

test("toggleNotificationCategory flips one category without mutating input", () => {
  const current = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const next = toggleNotificationCategory(current, "orders", false);
  assert.equal(current.orders, true);
  assert.equal(next.orders, false);
  assert.equal(next.inventory, true);
});
