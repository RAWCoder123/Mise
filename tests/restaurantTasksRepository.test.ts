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

  await assert.rejects(
    () => repository.completeRestaurantTask({
      restaurantId: DEMO_RESTAURANT_ID,
      taskId: countTask.id,
      completionResult: "Counted 18 lb",
      completionEvidence: [{ type: "count", quantity: 18, unit: "lb" }]
    }),
    /submitted or approved inventory count session/i
  );

  const inventoryItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  for (const item of inventoryItems) {
    await repository.verifyInventoryItemCanonicalUnit(
      DEMO_RESTAURANT_ID,
      item.id,
      item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each"
        ? item.canonical_unit
        : "each",
      item.canonical_quantity_per_unit && item.canonical_quantity_per_unit > 0
        ? item.canonical_quantity_per_unit
        : 1
    );
  }

  const session = await repository.beginInventoryCountSession(DEMO_RESTAURANT_ID, "Task verification count");
  await repository.saveInventoryCountLines(
    DEMO_RESTAURANT_ID,
    session.session.id,
    session.lines.map((line) => ({
      inventoryItemId: line.inventory_item_id,
      countedQuantity: Number(line.system_quantity_at_start),
      note: null
    }))
  );
  const submitted = await repository.submitInventoryCountSession(
    DEMO_RESTAURANT_ID,
    session.session.id
  );
  assert.equal(submitted.session.status, "submitted");

  const completed = await repository.completeRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: countTask.id,
    completionResult: "Counted 18 lb",
    completionEvidence: [
      {
        type: "count_session",
        countSessionId: submitted.session.id,
        status: "submitted"
      }
    ]
  });
  assert.equal(completed.status, "completed");

  const tasks = await repository.listRestaurantTasks(DEMO_RESTAURANT_ID);
  assert.equal(tasks.find((task) => task.id === orderTask.id)?.status, "waiting");
  const events = await repository.listActivityEvents(DEMO_RESTAURANT_ID);
  assert.ok(events.some((event) => event.activityType === "task_created"));
  assert.ok(events.some((event) => event.activityType === "task_completed"));
  assert.ok(events.some((event) => event.activityType === "task_unblocked"));
  assert.match(
    events.find((event) => event.activityType === "task_completed")?.summary ?? "",
    /Counted 18 lb/
  );

  const review = await repository.completeRestaurantTask({
    restaurantId: DEMO_RESTAURANT_ID,
    taskId: orderTask.id,
    completionResult: "Approved after verified count",
    completionEvidence: [{ type: "manager_review", note: "Count session reviewed" }]
  });
  assert.equal(review.status, "completed");
});
