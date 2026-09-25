import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";
import { normalizeInventoryItem } from "../services/miseValidation";

async function demoRepository() {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };
  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  return repository;
}

test("demo retains delayed waste that would breach current on-hand without applying it", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const chicken = items.find((item) => item.item_name === "Chicken breast");
  assert.ok(chicken);
  const normalized = normalizeInventoryItem(chicken);
  assert.equal(normalized.canonical_unit_verification_status, "verified");
  assert.ok(normalized.canonical_unit);
  assert.ok(normalized.canonical_quantity_per_unit);

  const countedQuantity = 2;
  const countedAt = "2026-09-25T13:00:00.000Z";
  const countAcceptance = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: chicken.id,
    eventType: "count",
    quantity: countedQuantity * normalized.canonical_quantity_per_unit!,
    canonicalUnit: normalized.canonical_unit!,
    effectiveAt: countedAt,
    source: "test_count",
    sourceReference: "count-boundary",
    reasonCode: null,
    clientEventId: "demo-count-boundary",
    idempotencyKey: "demo-count-boundary",
    supersedesEventId: null,
    metadata: {}
  });
  assert.equal(countAcceptance.status, "accepted");
  if (countAcceptance.status === "accepted") {
    assert.equal(countAcceptance.event.projectionApplied, true);
  }

  const afterCount = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
    (item) => item.id === chicken.id
  );
  assert.equal(afterCount?.current_quantity, countedQuantity);

  // Waste larger than post-count on-hand, but effective before the count. Hosted
  // keeps the row with projection_applied=false and does not run the floor check
  // against current_quantity. Demo must match.
  const delayedWaste = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: chicken.id,
    eventType: "waste",
    quantity: 10 * normalized.canonical_quantity_per_unit!,
    canonicalUnit: normalized.canonical_unit!,
    effectiveAt: "2026-09-25T12:00:00.000Z",
    source: "test_waste",
    sourceReference: "delayed-waste",
    reasonCode: "spoilage",
    clientEventId: "demo-delayed-waste",
    idempotencyKey: "demo-delayed-waste",
    supersedesEventId: null,
    metadata: {}
  });
  assert.equal(delayedWaste.status, "accepted");
  if (delayedWaste.status === "accepted") {
    assert.equal(delayedWaste.event.projectionApplied, false);
  }

  const afterDelayed = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
    (item) => item.id === chicken.id
  );
  assert.equal(afterDelayed?.current_quantity, countedQuantity);

  const events = await repository.listInventoryEvents(DEMO_RESTAURANT_ID);
  assert.equal(
    events.some(
      (event) =>
        event.inventoryItemId === chicken.id &&
        event.clientEventId === "demo-delayed-waste" &&
        event.projectionApplied === false
    ),
    true
  );
});

test("demo still rejects applied waste that would drive on-hand below zero", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const chicken = items.find((item) => item.item_name === "Chicken breast");
  assert.ok(chicken);
  const normalized = normalizeInventoryItem(chicken);
  assert.ok(normalized.canonical_unit);
  assert.ok(normalized.canonical_quantity_per_unit);

  const countedQuantity = 2;
  await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: chicken.id,
    eventType: "count",
    quantity: countedQuantity * normalized.canonical_quantity_per_unit!,
    canonicalUnit: normalized.canonical_unit!,
    effectiveAt: "2026-09-25T13:00:00.000Z",
    source: "test_count",
    sourceReference: "count-applied",
    reasonCode: null,
    clientEventId: "demo-count-applied",
    idempotencyKey: "demo-count-applied",
    supersedesEventId: null,
    metadata: {}
  });

  await assert.rejects(
    () =>
      repository.recordInventoryEvent({
        restaurantId: DEMO_RESTAURANT_ID,
        inventoryItemId: chicken.id,
        eventType: "waste",
        quantity: 10 * normalized.canonical_quantity_per_unit!,
        canonicalUnit: normalized.canonical_unit!,
        effectiveAt: "2026-09-25T14:00:00.000Z",
        source: "test_waste",
        sourceReference: "applied-waste",
        reasonCode: "spoilage",
        clientEventId: "demo-applied-waste",
        idempotencyKey: "demo-applied-waste",
        supersedesEventId: null,
        metadata: {}
      }),
    /outside supported limits/
  );

  const afterReject = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
    (item) => item.id === chicken.id
  );
  assert.equal(afterReject?.current_quantity, countedQuantity);
});
