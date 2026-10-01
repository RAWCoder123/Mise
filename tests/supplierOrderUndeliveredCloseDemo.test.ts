import assert from "node:assert/strict";
import test from "node:test";

import { closeSupplierOrderUndelivered } from "../services/application/deliveries";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import { DEMO_RESTAURANT_ID, type DemoState } from "../services/demoData";
import { resetDemoStore } from "../services/localStore";
import { createLocalDemoRepository } from "../services/repositories/demoRepository";
import { normalizeInventoryItem } from "../services/miseValidation";

const ORDER_ID = "00000000-0000-4000-8000-00000000aa11";

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

function seedUndeliveredSentOrder(state: DemoState) {
  const item = normalizeInventoryItem(state.inventoryItems[0]!);
  state.supplierOrders.push({
    id: ORDER_ID,
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    order_message: `${item.item_name} - 10 ${item.unit}`,
    operator_note: null,
    status: "sent",
    delivery_date: "2026-09-02",
    created_at: "2026-09-01T12:00:00.000Z"
  });
  state.purchaseRecommendations.push({
    id: "00000000-0000-4000-8000-00000000bb11",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    recommended_quantity: 10,
    unit: item.unit,
    reason: "Coverage below par.",
    urgency: "high",
    status: "ordered",
    supplier_order_id: ORDER_ID,
    created_at: "2026-09-01T12:00:00.000Z"
  });
  return item.id;
}

test("demo undelivered close completes without inventory writes and refuses prior deliveries", async () => {
  installLocalStorage();
  const repository = createLocalDemoRepository();
  const restore = setMiseRepositoryForTesting(repository);

  try {
    let itemId = "";
    await resetDemoStore("Toast", undefined, (state) => {
      itemId = seedUndeliveredSentOrder(state);
    });

    const beforeItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const before = beforeItems.find((entry) => entry.id === itemId)!;
    const quantityBefore = before.current_quantity;

    const closed = await closeSupplierOrderUndelivered(DEMO_RESTAURANT_ID, ORDER_ID, "never_arrived");
    assert.equal(closed.outcome, "applied");
    assert.equal(closed.priorDeliveryCount, 0);
    assert.equal(closed.reason, "never_arrived");

    const afterItems = await repository.fetchInventoryItems(DEMO_RESTAURANT_ID);
    const after = afterItems.find((entry) => entry.id === itemId)!;
    assert.equal(after.current_quantity, quantityBefore);

    const order = await repository.fetchSupplierOrder(DEMO_RESTAURANT_ID, ORDER_ID);
    assert.equal(order.status, "completed");

    const replay = await closeSupplierOrderUndelivered(
      DEMO_RESTAURANT_ID,
      ORDER_ID,
      "supplier_cancelled"
    );
    assert.equal(replay.outcome, "already_completed");

    await resetDemoStore("Toast", undefined, (state) => {
      seedUndeliveredSentOrder(state);
      state.supplierDeliveries = [
        ...(state.supplierDeliveries ?? []),
        {
          id: "00000000-0000-4000-8000-00000000dd11",
          restaurant_id: DEMO_RESTAURANT_ID,
          supplier_order_id: ORDER_ID,
          status: "received",
          received_at: "2026-09-02T15:00:00.000Z",
          client_delivery_id: "seed-delivered-1",
          notes: null,
          created_at: "2026-09-02T15:00:00.000Z"
        }
      ];
    });

    await assert.rejects(
      () => closeSupplierOrderUndelivered(DEMO_RESTAURANT_ID, ORDER_ID, "ordered_in_error"),
      /without delivery evidence/i
    );
  } finally {
    restore();
  }
});
