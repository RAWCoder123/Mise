import assert from "node:assert/strict";
import test from "node:test";

import {
  NOOP_STOCKOUT_MESSAGE,
  rejectNoOpStockoutReason
} from "../services/domain/stockoutNoOpGuard";
import { inventoryEventRejectionFromRpcError } from "../services/domain/inventoryEventTransport";
import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

test("rejectNoOpStockoutReason flags only stockouts at native zero", () => {
  assert.equal(
    rejectNoOpStockoutReason({ eventType: "stockout", currentNativeQuantity: 0 }),
    "noop_stockout"
  );
  assert.equal(
    rejectNoOpStockoutReason({ eventType: "stockout", currentNativeQuantity: 1.5 }),
    null
  );
  assert.equal(
    rejectNoOpStockoutReason({ eventType: "stockout", currentNativeQuantity: -0 }),
    "noop_stockout"
  );
  assert.equal(
    rejectNoOpStockoutReason({ eventType: "count", currentNativeQuantity: 0 }),
    null
  );
  assert.equal(
    rejectNoOpStockoutReason({ eventType: "waste", currentNativeQuantity: 0 }),
    null
  );
  assert.equal(
    rejectNoOpStockoutReason({ eventType: "stockout", currentNativeQuantity: Number.NaN }),
    null
  );
});

test("hosted noop-stockout message maps to terminal noop_stockout not invalid_quantity", () => {
  assert.equal(NOOP_STOCKOUT_MESSAGE.includes("quantity"), false);
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: NOOP_STOCKOUT_MESSAGE
    }),
    { status: "rejected", reason: "noop_stockout" }
  );
  assert.deepEqual(
    inventoryEventRejectionFromRpcError({
      code: "22023",
      message: "Invalid quantity for inventory event type"
    }),
    { status: "rejected", reason: "invalid_quantity" }
  );
});

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

test("demo rejects a second stockout when on-hand is already zero", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const item = items.find(
    (entry) =>
      entry.canonical_unit_verification_status === "verified" &&
      entry.canonical_unit &&
      entry.canonical_quantity_per_unit != null &&
      entry.canonical_quantity_per_unit > 0 &&
      entry.current_quantity > 0
  );
  assert.ok(item, "demo seed must include a verified on-hand item");

  const first = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: "2026-11-10T18:00:00.000Z",
    source: "operator_stockout",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "noop-stockout-first",
    idempotencyKey: "noop-stockout-first",
    supersedesEventId: null,
    metadata: {}
  });
  assert.equal(first.status, "accepted");

  const afterFirst = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
    (entry) => entry.id === item.id
  );
  assert.equal(afterFirst?.current_quantity, 0);

  const eventCountBefore = (
    await repository.listInventoryEvents(DEMO_RESTAURANT_ID, {
      eventTypes: ["stockout"]
    })
  ).filter((event) => event.inventoryItemId === item.id).length;

  const second = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: "2026-11-10T18:05:00.000Z",
    source: "operator_stockout",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "noop-stockout-second",
    idempotencyKey: "noop-stockout-second",
    supersedesEventId: null,
    metadata: {}
  });
  assert.deepEqual(second, { status: "rejected", reason: "noop_stockout" });

  const afterSecond = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
    (entry) => entry.id === item.id
  );
  assert.equal(afterSecond?.current_quantity, 0);

  const eventCountAfter = (
    await repository.listInventoryEvents(DEMO_RESTAURANT_ID, {
      eventTypes: ["stockout"]
    })
  ).filter((event) => event.inventoryItemId === item.id).length;
  assert.equal(eventCountAfter, eventCountBefore);
});

test("demo still accepts a stockout that zeros positive on-hand", async () => {
  const repository = await demoRepository();
  const items = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
  const item = items.find(
    (entry) =>
      entry.canonical_unit_verification_status === "verified" &&
      entry.canonical_unit &&
      entry.canonical_quantity_per_unit != null &&
      entry.canonical_quantity_per_unit > 0 &&
      entry.current_quantity > 0
  );
  assert.ok(item);

  const acceptance = await repository.recordInventoryEvent({
    restaurantId: DEMO_RESTAURANT_ID,
    inventoryItemId: item.id,
    eventType: "stockout",
    quantity: 0,
    canonicalUnit: item.canonical_unit!,
    effectiveAt: "2026-11-10T19:00:00.000Z",
    source: "operator_stockout",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "noop-stockout-positive",
    idempotencyKey: "noop-stockout-positive",
    supersedesEventId: null,
    metadata: {}
  });
  assert.equal(acceptance.status, "accepted");
  const updated = (await repository.fetchInventoryItems(DEMO_RESTAURANT_ID)).find(
    (entry) => entry.id === item.id
  );
  assert.equal(updated?.current_quantity, 0);
});
