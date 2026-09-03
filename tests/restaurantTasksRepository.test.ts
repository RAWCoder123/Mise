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

  await assert.rejects(
    () => repository.completeRestaurantTask({
      restaurantId: DEMO_RESTAURANT_ID,
      taskId: countTask.id,
      completionResult: "Counted 18 lb"
    }),
    /verification evidence is required/i
  );

  const cleared = await repository.reassignRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    assigneeUserId: null
  });
  assert.equal(cleared.assigneeUserId, null);
  const restored = await repository.reassignRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    assigneeUserId: DEMO_USER_ID
  });
  assert.equal(restored.assigneeUserId, DEMO_USER_ID);
  const reassignReplay = await repository.reassignRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    assigneeUserId: DEMO_USER_ID
  });
  assert.equal(reassignReplay.updatedAt, restored.updatedAt);

  const completed = await repository.completeRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    completionResult: "Counted 18 lb",
    completionEvidence: [{ type: "count", quantity: 18, unit: "lb" }]
  });
  assert.equal(completed.status, "completed");
  await assert.rejects(
    () => repository.reassignRestaurantTask({
      restaurantId: DEMO_RESTAURANT_ID,
      taskId: countTask.id,
      assigneeUserId: null
    }),
    /only open restaurant tasks can be reassigned/i
  );

  const tasks = await repository.listRestaurantTasks(DEMO_RESTAURANT_ID);
  assert.equal(tasks.find((task) => task.id === orderTask.id)?.status, "waiting");
  const events = await repository.listActivityEvents(DEMO_RESTAURANT_ID);
  assert.ok(events.some((event) => event.activityType === "task_created"));
  assert.ok(events.some((event) => event.activityType === "task_reassigned"));
  assert.ok(events.some((event) => event.activityType === "task_completed"));
  assert.ok(events.some((event) => event.activityType === "task_unblocked"));
  assert.match(
    events.find((event) => event.activityType === "task_completed")?.summary ?? "",
    /Counted 18 lb/
  );
});
