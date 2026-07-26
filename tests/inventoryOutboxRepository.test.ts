import assert from "node:assert/strict";
import test from "node:test";

import { createInventoryOutboxEntry } from "../services/domain/inventoryOutbox";
import type { InventoryEventInput } from "../services/domain/inventoryLedger";
import {
  createInventoryOutboxRepository,
  type InventoryOutboxStorage
} from "../services/repositories/inventoryOutboxRepository";

function event(restaurantId: string, clientEventId: string): InventoryEventInput {
  return {
    restaurantId,
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

test("persists outbox entries across repository instances and isolates tenants", async () => {
  const storage = memoryStorage();
  const firstRepository = createInventoryOutboxRepository(storage);
  await firstRepository.save(
    createInventoryOutboxEntry({
      id: "outbox-a",
      event: event("restaurant-a", "client-a"),
      now: "2026-07-26T10:00:00.000Z"
    })
  );
  await firstRepository.save(
    createInventoryOutboxEntry({
      id: "outbox-b",
      event: event("restaurant-b", "client-b"),
      now: "2026-07-26T10:01:00.000Z"
    })
  );

  const restartedRepository = createInventoryOutboxRepository(storage);
  assert.deepEqual(
    (await restartedRepository.list("restaurant-a")).map((entry) => entry.id),
    ["outbox-a"]
  );
  assert.deepEqual(
    (await restartedRepository.list("restaurant-b")).map((entry) => entry.id),
    ["outbox-b"]
  );
});

test("refuses to reuse a local outbox id for another server identity", async () => {
  const repository = createInventoryOutboxRepository(memoryStorage());
  await repository.save(
    createInventoryOutboxEntry({
      id: "outbox-1",
      event: event("restaurant-a", "client-a"),
      now: "2026-07-26T10:00:00.000Z"
    })
  );

  await assert.rejects(
    repository.save(
      createInventoryOutboxEntry({
        id: "outbox-1",
        event: event("restaurant-a", "client-replacement"),
        now: "2026-07-26T10:01:00.000Z"
      })
    ),
    /outbox_entry_identity_conflict/
  );
});

test("fails closed on corrupt or cross-tenant persisted data", async () => {
  const corruptStorage: InventoryOutboxStorage = {
    async getItem() {
      return "{not-json";
    },
    async setItem() {}
  };
  await assert.rejects(
    createInventoryOutboxRepository(corruptStorage).list("restaurant-a"),
    /inventory_outbox_corrupt/
  );

  const tenantStorage: InventoryOutboxStorage = {
    async getItem() {
      return JSON.stringify([
        createInventoryOutboxEntry({
          id: "outbox-b",
          event: event("restaurant-b", "client-b"),
          now: "2026-07-26T10:00:00.000Z"
        })
      ]);
    },
    async setItem() {}
  };
  await assert.rejects(
    createInventoryOutboxRepository(tenantStorage).list("restaurant-a"),
    /inventory_outbox_tenant_mismatch/
  );
});
