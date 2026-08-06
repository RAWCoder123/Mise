import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchQueuedInventoryEvents,
  flushQueuedInventoryEvents,
  queueInventoryOperation,
  queueInventoryEventForSubmission,
  setDeviceInventoryOutboxRepositoryForTesting,
  setInventoryEventSubmitterForTesting
} from "../services/application/deviceInventoryOutbox";
import type { InventoryEventInput } from "../services/domain/inventoryLedger";
import { createInMemoryInventoryEventRecorder } from "../services/domain/inventoryEventTransport";
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

test("operator queue API generates one stable retry identity after validation", async () => {
  const restore = setDeviceInventoryOutboxRepositoryForTesting(
    createInventoryOutboxRepository(memoryStorage())
  );
  try {
    const queued = await queueInventoryOperation({
      restaurantId: "restaurant-a",
      inventoryItemId: "chicken",
      eventType: "count",
      quantity: 1200,
      canonicalUnit: "g",
      effectiveAt: "2026-07-26T10:00:00.000Z",
      note: "Opening count"
    });

    assert.match(queued.id, /^inventory_outbox_/);
    assert.match(queued.event.clientEventId, /^inventory_event_/);
    assert.equal(
      queued.event.idempotencyKey,
      `inventory:${queued.event.clientEventId}`
    );
    assert.deepEqual(queued.event.metadata, { note: "Opening count" });
  } finally {
    restore();
  }
});

test("screen-safe flush sends through the active repository and persists authority", async () => {
  const outbox = createInventoryOutboxRepository(memoryStorage());
  const restoreOutbox = setDeviceInventoryOutboxRepositoryForTesting(outbox);
  const restoreSubmitter = setInventoryEventSubmitterForTesting(
    createInMemoryInventoryEventRecorder({
      actorUserId: "manager-1",
      idFor: (candidate) => `server-${candidate.clientEventId}`
    }).record
  );
  try {
    await queueInventoryEventForSubmission({
      outboxId: "outbox-flush-1",
      event,
      now: "2026-07-26T10:00:01.000Z"
    });
    const summary = await flushQueuedInventoryEvents("restaurant-a");
    const [settled] = await fetchQueuedInventoryEvents("restaurant-a");

    assert.deepEqual(summary, {
      considered: 1,
      accepted: 1,
      conflicted: 0,
      rejected: 0,
      deferred: 0
    });
    assert.equal(settled?.status, "accepted");
    assert.equal(settled?.authoritativeEvent?.clientEventId, event.clientEventId);
  } finally {
    restoreSubmitter();
    restoreOutbox();
  }
});

test("screen-safe flush defers transport failures instead of rejecting evidence", async () => {
  const outbox = createInventoryOutboxRepository(memoryStorage());
  const restoreOutbox = setDeviceInventoryOutboxRepositoryForTesting(outbox);
  const restoreSubmitter = setInventoryEventSubmitterForTesting(async () => {
    throw new TypeError("network unavailable");
  });
  try {
    await queueInventoryEventForSubmission({
      outboxId: "outbox-deferred-1",
      event: { ...event, clientEventId: "device-count-deferred" },
      now: "2026-07-26T10:00:01.000Z"
    });
    const summary = await flushQueuedInventoryEvents("restaurant-a");
    const [settled] = await fetchQueuedInventoryEvents("restaurant-a");

    assert.equal(summary.deferred, 1);
    assert.equal(settled?.status, "pending");
    assert.equal(settled?.resolutionReason, "network_retry");
  } finally {
    restoreSubmitter();
    restoreOutbox();
  }
});

test("demo repository deduplicates an exact retry under the same authority", async () => {
  const { record } = createInMemoryInventoryEventRecorder({
    actorUserId: "demo-user",
    idFor: (candidate) => `demo-${candidate.clientEventId}`,
    now: () => "2026-07-26T10:00:01.000Z"
  });
  const first = await record(event);
  const second = await record(event);

  assert.equal(first.status, "accepted");
  assert.equal(second.status, "duplicate");
  assert.equal(
    "event" in first ? first.event.id : null,
    "event" in second ? second.event.id : null
  );
});
