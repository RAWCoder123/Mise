import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_RESTAURANT_ID } from "../services/demo/replaceableDemoData";

test("demo apply updates sent-order delivery_date from seeded confirmation", async () => {
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
  await repository.resetDemoData(null, { preset: "default" });

  const orders = await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID);
  const sentOrder = orders.find((order) => order.status === "sent");
  assert.ok(sentOrder, "default demo preset should include a sent supplier order");

  const confirmations = await repository.fetchSupplierOrderConfirmations(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id
  });
  assert.equal(confirmations.length >= 1, true);
  const confirmation = confirmations[0]!;
  assert.ok(confirmation.expected_delivery_at);

  const before = await repository.fetchSupplierOrder(DEMO_RESTAURANT_ID, sentOrder.id);
  const result = await repository.applySupplierConfirmationDeliveryDate(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id,
    confirmationId: confirmation.id
  });
  assert.equal(result.outcome, "applied");
  assert.equal(result.confirmationId, confirmation.id);

  const after = await repository.fetchSupplierOrder(DEMO_RESTAURANT_ID, sentOrder.id);
  assert.equal(after.delivery_date, result.deliveryDate);
  assert.notEqual(after.delivery_date, before.delivery_date);

  const replay = await repository.applySupplierConfirmationDeliveryDate(DEMO_RESTAURANT_ID, {
    supplierOrderId: sentOrder.id,
    confirmationId: confirmation.id
  });
  assert.equal(replay.outcome, "already_applied");
  assert.equal(replay.deliveryDate, after.delivery_date);
});
