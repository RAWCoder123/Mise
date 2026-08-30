import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchInventoryItemLedgerHistory,
  ITEM_LEDGER_HISTORY_LIMIT
} from "../services/application/inventoryEvidence";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { MiseRepository } from "../services/repositories/miseRepository";
import {
  inventoryLedgerEventMessageKey,
  inventoryLedgerQuantityKind,
  inventoryLedgerSignedQuantity
} from "../services/presentation/inventoryLedgerPresentation";

function event(
  overrides: Partial<InventoryEvent> & Pick<InventoryEvent, "id" | "inventoryItemId" | "eventType" | "quantity">
): InventoryEvent {
  return {
    sequence: 1,
    restaurantId: "restaurant-a",
    canonicalUnit: "g",
    effectiveAt: "2026-08-30T12:00:00.000Z",
    recordedAt: "2026-08-30T12:00:01.000Z",
    actorUserId: "manager-1",
    source: "test",
    sourceReference: null,
    reasonCode: null,
    clientEventId: overrides.id,
    idempotencyKey: overrides.id,
    supersedesEventId: null,
    metadata: {},
    projectionApplied: true,
    ...overrides
  };
}

test("presentation maps ledger event types to signed quantity kinds", () => {
  assert.equal(inventoryLedgerQuantityKind("count"), "set");
  assert.equal(inventoryLedgerQuantityKind("stockout"), "stockout");
  assert.equal(inventoryLedgerQuantityKind("receipt"), "delta");
  assert.equal(inventoryLedgerQuantityKind("waste"), "delta");

  assert.equal(inventoryLedgerSignedQuantity(event({ id: "w1", inventoryItemId: "chicken", eventType: "waste", quantity: 900 })), -900);
  assert.equal(inventoryLedgerSignedQuantity(event({ id: "u1", inventoryItemId: "chicken", eventType: "usage", quantity: 100 })), -100);
  assert.equal(inventoryLedgerSignedQuantity(event({ id: "r1", inventoryItemId: "chicken", eventType: "receipt", quantity: 500 })), 500);
  assert.equal(inventoryLedgerSignedQuantity(event({ id: "a1", inventoryItemId: "chicken", eventType: "adjustment", quantity: -25 })), -25);
  assert.equal(inventoryLedgerSignedQuantity(event({ id: "s1", inventoryItemId: "chicken", eventType: "stockout", quantity: 0 })), 0);

  assert.equal(inventoryLedgerEventMessageKey("transfer"), "inventory.ops.event.transfer");
  assert.equal(inventoryLedgerEventMessageKey("correction"), "inventory.ops.event.correction");
});

test("item ledger history scopes by inventory item and reports truncation", async () => {
  const chicken = event({
    id: "chicken-1",
    inventoryItemId: "chicken",
    eventType: "waste",
    quantity: 100,
    sequence: 2,
    recordedAt: "2026-08-30T13:00:00.000Z"
  });
  const rice = event({
    id: "rice-1",
    inventoryItemId: "rice",
    eventType: "count",
    quantity: 5000,
    sequence: 1,
    recordedAt: "2026-08-30T12:00:00.000Z"
  });

  const calls: Array<{
    restaurantId: string;
    options?: Parameters<MiseRepository["listInventoryEvents"]>[1];
  }> = [];
  const restore = setMiseRepositoryForTesting({
    async listInventoryEvents(restaurantId: string, options?: Parameters<MiseRepository["listInventoryEvents"]>[1]) {
      calls.push({ restaurantId, options });
      assert.equal(options?.inventoryItemId, "chicken");
      return [chicken, rice].filter((entry) => entry.inventoryItemId === options?.inventoryItemId);
    }
  } as MiseRepository);

  try {
    const result = await fetchInventoryItemLedgerHistory(" restaurant-a ", " chicken ");
    assert.deepEqual(
      result.events.map((entry) => entry.id),
      ["chicken-1"]
    );
    assert.equal(result.truncated, false);
    assert.equal(calls[0]?.restaurantId, "restaurant-a");
    assert.equal(calls[0]?.options?.limit, ITEM_LEDGER_HISTORY_LIMIT);
  } finally {
    restore();
  }
});

test("item ledger history marks truncation when the bounded window is full", async () => {
  const restore = setMiseRepositoryForTesting({
    async listInventoryEvents(
      _restaurantId: string,
      options?: Parameters<MiseRepository["listInventoryEvents"]>[1]
    ) {
      const limit = options?.limit ?? ITEM_LEDGER_HISTORY_LIMIT;
      return Array.from({ length: limit }, (_, index) =>
        event({
          id: `event-${index}`,
          inventoryItemId: "chicken",
          eventType: "usage",
          quantity: index + 1,
          sequence: index + 1
        })
      );
    }
  } as MiseRepository);

  try {
    const result = await fetchInventoryItemLedgerHistory("restaurant-a", "chicken", { limit: 3 });
    assert.equal(result.events.length, 3);
    assert.equal(result.truncated, true);
  } finally {
    restore();
  }
});

test("item ledger history rejects blank restaurant or item identity", async () => {
  await assert.rejects(
    () => fetchInventoryItemLedgerHistory("  ", "chicken"),
    /Missing restaurant workspace/
  );
  await assert.rejects(
    () => fetchInventoryItemLedgerHistory("restaurant-a", " "),
    /Missing inventory item/
  );
});
