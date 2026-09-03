import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID, DEMO_USER_ID } from "../services/demoData";

test("demo shared tasks mirror hosted idempotency, dependencies, verification, and activity", async () => {
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

  const countTask = await repository.createRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    clientTaskId: "demo-shared-count",
    title: "Confirm chicken count",
    operationalCategory: "inventory",
    priority: "urgent",
    timingBucket: "now",
    serviceWindow: "before_supplier_cutoff",
    assigneeUserId: DEMO_USER_ID,
    verificationMethod: "count",
    checklist: [{ label: "Record physical count" }]
  });
  const replay = await repository.createRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    clientTaskId: "demo-shared-count",
    title: "Confirm chicken count",
    operationalCategory: "inventory",
    priority: "urgent",
    timingBucket: "now",
    serviceWindow: "before_supplier_cutoff",
    assigneeUserId: DEMO_USER_ID,
    verificationMethod: "count",
    checklist: [{ label: "Record physical count" }]
  });
  assert.equal(replay.id, countTask.id);
  await assert.rejects(
    () => repository.createRestaurantTask({
      restaurantId: DEMO_RESTAURANT_ID,
      clientTaskId: "demo-shared-count",
      title: "Confirm chicken count",
      operationalCategory: "inventory",
      priority: "high",
      timingBucket: "now",
      serviceWindow: "before_supplier_cutoff",
      assigneeUserId: DEMO_USER_ID,
      verificationMethod: "count",
      checklist: [{ label: "Record physical count" }]
    }),
    /different request/i
  );

  const orderTask = await repository.createRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    clientTaskId: "demo-shared-order",
    title: "Review emergency order",
    origin: "approval",
    operationalCategory: "orders",
    requiredRole: "manager",
    verificationMethod: "manager_review",
    dependencyIds: [countTask.id]
  });
  assert.equal(orderTask.status, "blocked");

  const moved = await repository.rescheduleRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    timingBucket: "up_next",
    dueAt: "2026-09-04T17:00:00.000Z"
  });
  assert.equal(moved.timingBucket, "up_next");
  assert.equal(moved.dueAt, "2026-09-04T17:00:00.000Z");
  const clearedDue = await repository.rescheduleRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    timingBucket: "later",
    dueAt: null
  });
  assert.equal(clearedDue.timingBucket, "later");
  assert.equal(clearedDue.dueAt, null);
  const rescheduleReplay = await repository.rescheduleRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    timingBucket: "later",
    dueAt: null
  });
  assert.equal(rescheduleReplay.updatedAt, clearedDue.updatedAt);

  await assert.rejects(
    () => repository.completeRestaurantTask({
      restaurantId: DEMO_RESTAURANT_ID,
      taskId: countTask.id,
      completionResult: "Counted 18 lb"
    }),
    /verification evidence is required/i
  );

  const completed = await repository.completeRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    completionResult: "Counted 18 lb",
    completionEvidence: [{ type: "count", quantity: 18, unit: "lb" }]
  });
  assert.equal(completed.status, "completed");
  await assert.rejects(
    () => repository.rescheduleRestaurantTask({
      restaurantId: DEMO_RESTAURANT_ID,
      taskId: countTask.id,
      timingBucket: "now",
      dueAt: null
    }),
    /only open restaurant tasks can be rescheduled/i
  );

  const tasks = await repository.listRestaurantTasks(DEMO_RESTAURANT_ID);
  assert.equal(tasks.find((task) => task.id === orderTask.id)?.status, "waiting");
  const events = await repository.listActivityEvents(DEMO_RESTAURANT_ID);
  assert.ok(events.some((event) => event.activityType === "task_created"));
  assert.ok(events.some((event) => event.activityType === "task_rescheduled"));
  assert.ok(events.some((event) => event.activityType === "task_completed"));
  assert.ok(events.some((event) => event.activityType === "task_unblocked"));
  assert.match(
    events.find((event) => event.activityType === "task_completed")?.summary ?? "",
    /Counted 18 lb/
  );
});
