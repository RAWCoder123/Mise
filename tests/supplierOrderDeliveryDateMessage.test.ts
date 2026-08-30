import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  buildSupplierOrderMessage,
  formatSupplierOrderDeliveryLine
} from "../services/domain/miseDomain";
import { DEMO_RESTAURANT_ID } from "../services/demoData";
import type { PurchaseRecommendation } from "../types/mise";

test("supplier order delivery line uses structured YYYY-MM-DD or an explicit pending label", () => {
  assert.equal(formatSupplierOrderDeliveryLine("2026-08-31"), "Delivery requested: 2026-08-31");
  assert.equal(formatSupplierOrderDeliveryLine(null), "Delivery requested: To be confirmed");
  assert.equal(formatSupplierOrderDeliveryLine(" tomorrow "), "Delivery requested: To be confirmed");
  assert.equal(formatSupplierOrderDeliveryLine("2026-8-31"), "Delivery requested: To be confirmed");
});

test("supplier order messages embed the structured delivery date for fingerprint parity", () => {
  const recommendation: PurchaseRecommendation = {
    id: "rec_1",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: "inv_1",
    item_name: "Roma Tomatoes",
    supplier_id: "sup_1",
    supplier_name: "Local Produce Co.",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Par gap",
    urgency: "medium",
    status: "approved",
    supplier_order_id: "order_1",
    created_at: "2026-08-29T12:00:00.000Z"
  };
  const message = buildSupplierOrderMessage(
    "Local Produce Co.",
    [recommendation],
    "Call on arrival.",
    "2026-09-01"
  );
  assert.match(message, /Delivery requested: 2026-09-01/);
  assert.doesNotMatch(message, /Tomorrow morning/);
  assert.match(message, /Notes:\nCall on arrival\./);
});

test("demo draft updates rebuild the message when delivery_date changes", async () => {
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
  await repository.resetDemoData(null);
  const draft = (await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID)).find(
    (order) => order.status === "draft"
  );
  assert.ok(draft);
  assert.ok(draft.delivery_date);
  assert.match(draft.order_message, new RegExp(`Delivery requested: ${draft.delivery_date}`));

  const updated = await repository.updateSupplierOrder(DEMO_RESTAURANT_ID, draft.id, {
    delivery_date: "2026-09-15"
  });
  assert.equal(updated.delivery_date, "2026-09-15");
  assert.match(updated.order_message, /Delivery requested: 2026-09-15/);
  assert.doesNotMatch(updated.order_message, /Tomorrow morning/);

  const preview = await repository.previewSupplierSendContent(DEMO_RESTAURANT_ID, updated.id);
  assert.equal(preview.deliveryDate, "2026-09-15");
  assert.match(preview.body, /Delivery requested: 2026-09-15/);
  assert.ok(!preview.blockerCodes.includes("send_content_invalid"));
});

test("hosted migration wires message builder and send-content expected body to delivery_date", () => {
  const migration = readFileSync(
    "supabase/migrations/20260830001000_supplier_order_delivery_date_message.sql",
    "utf8"
  );
  assert.match(migration, /Delivery requested: ' \|\| coalesce\(/);
  assert.match(migration, /to_char\(\(select delivery_date from order_delivery\), 'YYYY-MM-DD'\)/);
  assert.match(migration, /To be confirmed/);
  assert.match(migration, /expected_body := private\.build_supplier_order_message\(/);
  assert.doesNotMatch(migration, /Tomorrow morning/);
  assert.match(migration, /where orders\.status = 'draft'/);
});
