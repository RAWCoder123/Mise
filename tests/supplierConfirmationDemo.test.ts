import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demoData";

test("demo managers can record and reload supplier confirmation evidence", async () => {
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
  const {
    buildSupplierOrderConfirmationEvidence
  } = await import("../services/domain/supplierConfirmation");

  const repository = createLocalDemoRepository();
  await repository.resetDemoData("Square", { preset: "default" });

  const orders = await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID);
  const sentOrder = orders.find((order) => order.status === "sent");
  assert.ok(sentOrder, "demo seeds a sent supplier order");

  const before = await repository.fetchSupplierOrderConfirmations(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id
  });
  // Default demo may already seed confirmations on completed orders; the sent
  // order should still be free for a manager to record.
  assert.equal(before.length, 0);

  const first = await repository.recordSupplierOrderConfirmation(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id,
    clientConfirmationId: "demo-manual-confirm-1",
    confirmationStatus: "acknowledged",
    confirmationReference: "DEMO-PO-1"
  });
  assert.equal(first.outcome, "applied");
  assert.equal(first.status, "acknowledged");

  const replay = await repository.recordSupplierOrderConfirmation(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id,
    clientConfirmationId: "demo-manual-confirm-1",
    confirmationStatus: "acknowledged",
    confirmationReference: "DEMO-PO-1"
  });
  assert.equal(replay.outcome, "already_applied");
  assert.equal(replay.confirmationId, first.confirmationId);

  const after = await repository.fetchSupplierOrderConfirmations(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id
  });
  const evidence = buildSupplierOrderConfirmationEvidence({
    restaurantId: DEMO_RESTAURANT_ID,
    orderId: sentOrder.id,
    confirmations: after
  });
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.status, "acknowledged");
  assert.equal(evidence[0]?.reference, "DEMO-PO-1");
  assert.equal(evidence[0]?.source, "manager_manual");
});
