import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  filterOperationalTodayTasksByNotificationPreferences,
  normalizeNotificationPreferences,
  notificationCategoryForTodayTask,
  toggleNotificationCategory,
  type OperatorNotificationPreferences
} from "../services/domain/notificationPreferences";
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
      code: partial.code as OperationalTodayTask["presentation"]["code"],
      values: {}
    },
    priority: "normal",
    dueDate: null,
    createdAt: "2026-08-02T12:00:00.000Z",
    action: {
      intent: "review_insight",
      label: "Review",
      route: "/insights",
      entityId: null
    },
    requiredRole: "manager",
    completion: {
      isComplete: false,
      canToggleDirectly: false,
      reason: "open"
    }
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
    notificationCategoryForTodayTask(task({ id: "order", code: "today.order.receive" })),
    "orders"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "waste", code: "today.waste.chronic_waste" })),
    "waste"
  );
  assert.equal(
    notificationCategoryForTodayTask(task({ id: "recipe", code: "today.recipe.map_unmapped" })),
    "recipes_pos"
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
    task({ id: "orders", code: "today.ordering.chronic_short_ship" })
  ];

  const filtered = filterOperationalTodayTasksByNotificationPreferences(tasks, muted);
  assert.deepEqual(
    filtered.map((entry) => entry.id),
    ["inventory", "orders"]
  );
});

test("toggleNotificationCategory flips one category without mutating input", () => {
  const current = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const next = toggleNotificationCategory(current, "orders", false);
  assert.equal(current.orders, true);
  assert.equal(next.orders, false);
  assert.equal(next.inventory, true);
});
