import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchQueuedInventoryEvents,
  queueInventoryEventForSubmission,
  setDeviceInventoryOutboxRepositoryForTesting
} from "../services/application/deviceInventoryOutbox";
import type { InventoryEventInput } from "../services/domain/inventoryLedger";
import {
  createInventoryOutboxRepository,
  type InventoryOutboxStorage
} from "../services/repositories/inventoryOutboxRepository";

function memoryStorage(): InventoryOutboxStorage {
  const values = new Map<string, string>();
  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    }
  };
}

const event: InventoryEventInput = {
  restaurantId: "restaurant-a",
  inventoryItemId: "chicken",
  eventType: "count",
  quantity: 1200,
  canonicalUnit: "g",
  effectiveAt: "2026-07-26T10:00:00.000Z",
  source: "manual_count",
  sourceReference: null,
  reasonCode: null,
  clientEventId: "device-count-1",
  idempotencyKey: "count:device-count-1",
  supersedesEventId: null,
  metadata: {}
};

test("screen-safe queue API persists a stable offline event by restaurant", async () => {
  const restore = setDeviceInventoryOutboxRepositoryForTesting(
    createInventoryOutboxRepository(memoryStorage())
  );
  try {
    const queued = await queueInventoryEventForSubmission({
      outboxId: "outbox-1",
      event,
      now: "2026-07-26T10:00:01.000Z"
    });
    assert.equal(queued.status, "pending");
    assert.equal(queued.event.clientEventId, "device-count-1");

    const restaurantA = await fetchQueuedInventoryEvents("restaurant-a");
    const restaurantB = await fetchQueuedInventoryEvents("restaurant-b");
    assert.deepEqual(restaurantA.map((entry) => entry.id), ["outbox-1"]);
    assert.deepEqual(restaurantB, []);
  } finally {
    restore();
  }
});
