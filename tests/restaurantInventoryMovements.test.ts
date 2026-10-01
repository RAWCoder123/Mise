import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchRestaurantInventoryMovements,
  inventoryEventTypesForMovementFilter,
  RESTAURANT_MOVEMENTS_LIMIT
} from "../services/application/inventoryEvidence";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { MiseRepository } from "../services/repositories/miseRepository";
import {
  inventoryLedgerEventMessageKey,
  inventoryLedgerQuantityKind,
  inventoryLedgerSignedQuantity
} from "../services/presentation/inventoryLedgerPresentation";
import type { InventoryItem } from "../types/mise";

function event(
  overrides: Partial<InventoryEvent> &
    Pick<InventoryEvent, "id" | "inventoryItemId" | "eventType" | "quantity">
): InventoryEvent {
  return {
    sequence: 1,
    restaurantId: "restaurant-a",
    canonicalUnit: "g",
    effectiveAt: "2026-08-31T12:00:00.000Z",
    recordedAt: "2026-08-31T12:00:01.000Z",
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

function item(id: string, itemName: string): InventoryItem {
  return {
    id,
    restaurant_id: "restaurant-a",
    item_name: itemName,
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2,
    supplier_id: "supplier-a",
    supplier_name: "Sysco",
    last_updated: "2026-08-31T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: "verified"
  };
}

test("presentation maps ledger event types to signed quantity kinds", () => {
  assert.equal(inventoryLedgerQuantityKind("count"), "set");
  assert.equal(inventoryLedgerQuantityKind("stockout"), "stockout");
  assert.equal(inventoryLedgerQuantityKind("receipt"), "delta");
  assert.equal(inventoryLedgerQuantityKind("waste"), "delta");

  assert.equal(
    inventoryLedgerSignedQuantity(
      event({ id: "w1", inventoryItemId: "chicken", eventType: "waste", quantity: 900 })
    ),
    -900
  );
  assert.equal(
    inventoryLedgerSignedQuantity(
      event({ id: "u1", inventoryItemId: "chicken", eventType: "usage", quantity: 100 })
    ),
    -100
  );
  assert.equal(
    inventoryLedgerSignedQuantity(
      event({ id: "r1", inventoryItemId: "chicken", eventType: "receipt", quantity: 500 })
    ),
    500
  );
  assert.equal(
    inventoryLedgerSignedQuantity(
      event({ id: "a1", inventoryItemId: "chicken", eventType: "adjustment", quantity: -25 })
    ),
    -25
  );
  assert.equal(
    inventoryLedgerSignedQuantity(
      event({ id: "s1", inventoryItemId: "chicken", eventType: "stockout", quantity: 0 })
    ),
    0
  );

  assert.equal(inventoryLedgerEventMessageKey("transfer"), "inventory.ops.event.transfer");
  assert.equal(inventoryLedgerEventMessageKey("correction"), "inventory.ops.event.correction");
});

test("movement filter maps adjustment to adjustment and correction event types", () => {
  assert.equal(inventoryEventTypesForMovementFilter("all"), undefined);
  assert.deepEqual(inventoryEventTypesForMovementFilter("waste"), ["waste"]);
  assert.deepEqual(inventoryEventTypesForMovementFilter("adjustment"), [
    "adjustment",
    "correction"
  ]);
});

test("restaurant movements join item names, scope tenants, and report truncation", async () => {
  const chickenWaste = event({
    id: "chicken-waste",
    inventoryItemId: "chicken",
    eventType: "waste",
    quantity: 200,
    sequence: 3,
    recordedAt: "2026-08-31T14:00:00.000Z"
  });
  const orphanReceipt = event({
    id: "orphan-receipt",
    inventoryItemId: "retired-item",
    eventType: "receipt",
    quantity: 1000,
    sequence: 2,
    recordedAt: "2026-08-31T13:00:00.000Z"
  });
  const otherTenant = event({
    id: "other",
    restaurantId: "restaurant-b",
    inventoryItemId: "chicken",
    eventType: "waste",
    quantity: 50,
    sequence: 1,
    recordedAt: "2026-08-31T12:00:00.000Z"
  });

  const calls: Array<{
    restaurantId: string;
    options?: Parameters<MiseRepository["listInventoryEvents"]>[1];
  }> = [];

  const restore = setMiseRepositoryForTesting({
    async listInventoryEvents(
      restaurantId: string,
      options?: Parameters<MiseRepository["listInventoryEvents"]>[1]
    ) {
      calls.push({ restaurantId, options });
      const allowed = options?.eventTypes ? new Set(options.eventTypes) : null;
      return [chickenWaste, orphanReceipt, otherTenant].filter((entry) => {
        if (entry.restaurantId !== restaurantId) return false;
        if (allowed && !allowed.has(entry.eventType)) return false;
        return true;
      });
    },
    async fetchInventoryItems(restaurantId: string) {
      assert.equal(restaurantId, "restaurant-a");
      return [item("chicken", "Chicken thighs")];
    }
  } as unknown as MiseRepository);

  try {
    const result = await fetchRestaurantInventoryMovements(" restaurant-a ", {
      filter: "waste",
      limit: 1
    });
    assert.equal(result.restaurantId, "restaurant-a");
    assert.equal(result.filter, "waste");
    assert.deepEqual(
      result.movements.map((row) => ({
        id: row.event.id,
        itemName: row.itemName
      })),
      [{ id: "chicken-waste", itemName: "Chicken thighs" }]
    );
    assert.equal(result.truncated, true);
    assert.equal(calls[0]?.restaurantId, "restaurant-a");
    assert.deepEqual(calls[0]?.options?.eventTypes, ["waste"]);
    assert.equal(calls[0]?.options?.limit, 1);

    const orphanResult = await fetchRestaurantInventoryMovements("restaurant-a", {
      filter: "receipt"
    });
    assert.deepEqual(
      orphanResult.movements.map((row) => ({
        id: row.event.id,
        itemName: row.itemName
      })),
      [{ id: "orphan-receipt", itemName: null }]
    );
    assert.equal(orphanResult.truncated, false);
  } finally {
    restore();
  }
});

test("restaurant movements default limit and reject blank restaurant identity", async () => {
  const restore = setMiseRepositoryForTesting({
    async listInventoryEvents(
      _restaurantId: string,
      options?: Parameters<MiseRepository["listInventoryEvents"]>[1]
    ) {
      assert.equal(options?.limit, RESTAURANT_MOVEMENTS_LIMIT);
      assert.equal(options?.eventTypes, undefined);
      return [];
    },
    async fetchInventoryItems() {
      return [];
    }
  } as unknown as MiseRepository);

  try {
    const result = await fetchRestaurantInventoryMovements("restaurant-a");
    assert.equal(result.movements.length, 0);
    assert.equal(result.truncated, false);
    await assert.rejects(
      () => fetchRestaurantInventoryMovements("  "),
      /Missing restaurant workspace/
    );
  } finally {
    restore();
  }
});
