import assert from "node:assert/strict";
import test from "node:test";

import { flushInventoryOutbox } from "../services/application/inventoryOutbox";
import { createInventoryOutboxEntry } from "../services/domain/inventoryOutbox";
import type { InventoryEvent, InventoryEventInput } from "../services/domain/inventoryLedger";
import {
  createInventoryOutboxRepository,
  type InventoryOutboxStorage
} from "../services/repositories/inventoryOutboxRepository";

function event(clientEventId: string): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "receiving",
    sourceReference: "delivery-1",
    reasonCode: null,
    clientEventId,
    idempotencyKey: `receiving:${clientEventId}`,
    supersedesEventId: null,
    metadata: {}
  };
}

function serverEvent(input: InventoryEventInput, id: string): InventoryEvent {
  return {
    ...input,
    id,
    sequence: 1,
    actorUserId: "manager-1",
    recordedAt: "2026-07-26T10:00:02.000Z"
  };
}

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

test("flushes due entries and persists authoritative acceptance", async () => {
  const repository = createInventoryOutboxRepository(memoryStorage());
  const pendingEvent = event("client-1");
  await repository.save(
    createInventoryOutboxEntry({
      id: "outbox-1",
      event: pendingEvent,
      now: "2026-07-26T10:00:00.000Z"
    })
  );

  const summary = await flushInventoryOutbox({
    restaurantId: "restaurant-a",
    repository,
    submit: async (entry) => ({
      status: "accepted",
      event: serverEvent(entry.event, "server-1")
    }),
    now: () => "2026-07-26T10:00:02.000Z"
  });

  assert.deepEqual(summary, {
    considered: 1,
    accepted: 1,
    conflicted: 0,
    rejected: 0,
    deferred: 0
  });
  const [settled] = await repository.list("restaurant-a");
  assert.equal(settled?.status, "accepted");
  assert.equal(settled?.authoritativeEvent?.id, "server-1");
});

test("network failure returns an entry to pending with bounded retry timing", async () => {
  const repository = createInventoryOutboxRepository(memoryStorage());
  await repository.save(
    createInventoryOutboxEntry({
      id: "outbox-1",
      event: event("client-1"),
      now: "2026-07-26T10:00:00.000Z"
    })
  );

  const summary = await flushInventoryOutbox({
    restaurantId: "restaurant-a",
    repository,
    submit: async () => {
      throw new Error("offline");
    },
    now: () => "2026-07-26T10:00:02.000Z"
  });

  assert.equal(summary.deferred, 1);
  const [deferred] = await repository.list("restaurant-a");
  assert.equal(deferred?.status, "pending");
  assert.equal(deferred?.attemptCount, 1);
  assert.equal(deferred?.nextAttemptAt, "2026-07-26T10:00:03.000Z");
});

test("server conflicts are terminal and remain visible after restart", async () => {
  const storage = memoryStorage();
  const repository = createInventoryOutboxRepository(storage);
  const pendingEvent = event("client-1");
  await repository.save(
    createInventoryOutboxEntry({
      id: "outbox-1",
      event: pendingEvent,
      now: "2026-07-26T10:00:00.000Z"
    })
  );

  const summary = await flushInventoryOutbox({
    restaurantId: "restaurant-a",
    repository,
    submit: async () => ({
      status: "conflict",
      reason: "idempotency_payload_mismatch",
      existingEvent: serverEvent({ ...pendingEvent, quantity: 2000 }, "server-existing")
    }),
    now: () => "2026-07-26T10:00:02.000Z"
  });

  assert.equal(summary.conflicted, 1);
  const restarted = createInventoryOutboxRepository(storage);
  const [conflict] = await restarted.list("restaurant-a");
  assert.equal(conflict?.status, "conflict");
  assert.equal(conflict?.resolutionReason, "idempotency_payload_mismatch");
  assert.equal(conflict?.authoritativeEvent?.id, "server-existing");
});
