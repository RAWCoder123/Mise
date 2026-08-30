import assert from "node:assert/strict";
import test from "node:test";

import {
  closeSupplierOrderAcceptingShort,
  receiveSupplierOrderDelivery,
  SupplierOrderReceiveBlockedError
} from "../services/application/deliveries";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import { DEMO_RESTAURANT_ID, type DemoState } from "../services/demoData";
import { mutateDemoState, resetDemoStore } from "../services/localStore";
import { createLocalDemoRepository } from "../services/repositories/demoRepository";
import { normalizeInventoryItem } from "../services/miseValidation";

const FIXED_NOW = new Date("2026-08-02T16:00:00.000Z");

function installLocalStorage() {
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
}

function seedPartialOpenOrder(
  state: DemoState,
  orderedQuantity: number,
  receivedQuantity: number,
  missingQuantity: number
) {
  const item = normalizeInventoryItem(state.inventoryItems[0]!);
  const orderId = "00000000-0000-4000-8000-00000000aa02";
  const deliveryId = "00000000-0000-4000-8000-00000000dd01";
  state.supplierOrders.push({
    id: orderId,
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    order_message: `${item.item_name} - ${orderedQuantity} ${item.unit}`,
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-02",
    created_at: "2026-08-01T12:00:00.000Z"
  });
  state.purchaseRecommendations.push({
    id: "00000000-0000-4000-8000-00000000bb02",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    recommended_quantity: orderedQuantity,
    unit: item.unit,
    reason: "Coverage below par.",
    urgency: "high",
    status: "ordered",
    supplier_order_id: orderId,
    created_at: "2026-08-01T12:00:00.000Z"
  });
  state.supplierDeliveries = [
    ...(state.supplierDeliveries ?? []),
    {
      id: deliveryId,
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_order_id: orderId,
      status: missingQuantity > 0 ? "discrepancy" : "partially_received",
      received_at: "2026-08-02T15:00:00.000Z",
      client_delivery_id: "seed-partial-1",
      notes: "First truck",
      created_at: "2026-08-02T15:00:00.000Z"
    }
  ];
  state.supplierDeliveryItems = [
    ...(state.supplierDeliveryItems ?? []),
    {
      id: `${deliveryId}:1`,
      restaurant_id: DEMO_RESTAURANT_ID,
      delivery_id: deliveryId,
      inventory_item_id: item.id,
      ordered_quantity: orderedQuantity,
      received_quantity: receivedQuantity,
      damaged_quantity: 0,
      missing_quantity: missingQuantity,
      canonical_unit:
        item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each"
          ? item.canonical_unit
          : "each"
    }
  ];
  return { itemId: item.id, orderId };
}

test("demo receive nets remaining quantities and short-close completes without inventory writes", async () => {
  installLocalStorage();
  const repository = createLocalDemoRepository();
  const restore = setMiseRepositoryForTesting(repository);

  try {
    let seededItemId = "";
    await resetDemoStore("Toast", undefined, (state) => {
      seededItemId = seedPartialOpenOrder(state, 10, 6, 0).itemId;
    });

    const beforeItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const before = beforeItems.find((entry) => entry.id === seededItemId)!;
    const quantityBefore = before.current_quantity;

    const remaining = await receiveSupplierOrderDelivery(DEMO_RESTAURANT_ID, "00000000-0000-4000-8000-00000000aa02", {
      receivedAt: "2026-08-02T17:00:00.000Z",
      clientDeliveryId: "test-delivery-remaining-1"
    });
    assert.equal(remaining.outcome, "applied");
    assert.equal(remaining.status, "received");

    const afterItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const after = afterItems.find((entry) => entry.id === seededItemId)!;
    assert.equal(after.current_quantity, quantityBefore + 4);

    const closedOrder = await repository.fetchSupplierOrder(
      DEMO_RESTAURANT_ID,
      "00000000-0000-4000-8000-00000000aa02"
    );
    assert.equal(closedOrder.status, "completed");

    await assert.rejects(
      () =>
        receiveSupplierOrderDelivery(DEMO_RESTAURANT_ID, "00000000-0000-4000-8000-00000000aa02", {
          receivedAt: "2026-08-02T18:00:00.000Z",
          clientDeliveryId: "test-delivery-remaining-2"
        }),
      (error: unknown) =>
        error instanceof SupplierOrderReceiveBlockedError && error.code === "nothing_remaining"
    );

    let shortItemId = "";
    await resetDemoStore("Toast", undefined, (state) => {
      shortItemId = seedPartialOpenOrder(state, 10, 7, 3).itemId;
    });
    const shortBeforeItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const shortBefore = shortBeforeItems.find((entry) => entry.id === shortItemId)!;
    const shortQuantityBefore = shortBefore.current_quantity;

    const closed = await closeSupplierOrderAcceptingShort(
      DEMO_RESTAURANT_ID,
      "00000000-0000-4000-8000-00000000aa02"
    );
    assert.equal(closed.outcome, "applied");
    assert.equal(closed.priorDeliveryCount, 1);

    const shortAfterItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const shortAfter = shortAfterItems.find((entry) => entry.id === shortItemId)!;
    assert.equal(shortAfter.current_quantity, shortQuantityBefore);

    const afterCloseOrder = await repository.fetchSupplierOrder(
      DEMO_RESTAURANT_ID,
      "00000000-0000-4000-8000-00000000aa02"
    );
    assert.equal(afterCloseOrder.status, "completed");

    // Closing refuses orders without prior delivery evidence.
    await mutateDemoState((state) => {
      state.supplierOrders.push({
        id: "00000000-0000-4000-8000-00000000aa09",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_id: shortBefore.supplier_id,
        supplier_name: shortBefore.supplier_name,
        order_message: "Open with no deliveries",
        operator_note: null,
        status: "sent",
        delivery_date: "2026-08-03",
        created_at: FIXED_NOW.toISOString()
      });
    });
    await assert.rejects(
      () => closeSupplierOrderAcceptingShort(DEMO_RESTAURANT_ID, "00000000-0000-4000-8000-00000000aa09"),
      /prior delivery evidence/i
    );
  } finally {
    restore();
  }
});
