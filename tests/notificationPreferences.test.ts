import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORIES,
  areOperationalTodayTasksHiddenByNotificationPreferences,
  countHiddenOperationalTodayTasksByNotificationPreferences,
  filterOperationalTodayTasksByNotificationPreferences,
  normalizeNotificationPreferences,
  notificationCategoryForTodayTask,
  toggleNotificationCategory,
  type OperatorNotificationPreferences
} from "../services/domain/notificationPreferences";
import type { OperationalTodayTask } from "../services/domain/todayTasks";
import type { TodayTaskPresentationDescriptor } from "../types/presentation";

function task(partial: {
  id: string;
  code: TodayTaskPresentationDescriptor["code"];
  sourceKind?: OperationalTodayTask["source"]["kind"];
}): Pick<OperationalTodayTask, "id" | "presentation" | "source"> {
  return {
    id: partial.id,
    source: {
      kind: partial.sourceKind ?? "insight",
      id: partial.id,
      status: "open"
    },
    presentation: {
      code: partial.code,
      values: {}
    } as TodayTaskPresentationDescriptor
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

test("countHiddenOperationalTodayTasksByNotificationPreferences separates muted work from all-clear", () => {
  const muted: OperatorNotificationPreferences = {
    inventory: false,
    orders: false,
    waste: false,
    recipes_pos: false,
    insights: false,
    setup: false
  };
  const tasks = [
    task({ id: "setup", code: "today.setup.inventory.open" }),
    task({ id: "pos", code: "today.integration.connect" })
  ];

  assert.equal(countHiddenOperationalTodayTasksByNotificationPreferences(tasks, muted), 2);
  assert.equal(areOperationalTodayTasksHiddenByNotificationPreferences(tasks, muted), true);
  assert.equal(
    areOperationalTodayTasksHiddenByNotificationPreferences(tasks, DEFAULT_NOTIFICATION_PREFERENCES),
    false
  );
  assert.equal(areOperationalTodayTasksHiddenByNotificationPreferences([], muted), false);
});
