import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupplierOrderConfirmationEvidence,
  confirmationClientIdForOrder,
  type SupplierOrderConfirmationRecord
} from "../services/domain/supplierConfirmation";

const RESTAURANT_ID = "restaurant-a";
const ORDER_ID = "order-1";

function confirmation(
  id: string,
  status: SupplierOrderConfirmationRecord["confirmation_status"],
  receivedAt: string,
  overrides: Partial<SupplierOrderConfirmationRecord> = {}
): SupplierOrderConfirmationRecord {
  return {
    id,
    restaurant_id: RESTAURANT_ID,
    supplier_order_id: ORDER_ID,
    confirmation_status: status,
    confirmation_reference: null,
    expected_delivery_at: null,
    received_at: receivedAt,
    source: "manager_manual",
    idempotency_key: `manager_confirmation:${id}`,
    created_at: receivedAt,
    ...overrides
  };
}

test("confirmation evidence is latest-first and scoped to one order", () => {
  const evidence = buildSupplierOrderConfirmationEvidence({
    restaurantId: RESTAURANT_ID,
    orderId: ORDER_ID,
    confirmations: [
      confirmation("c1", "acknowledged", "2026-09-01T10:00:00.000Z", {
        confirmation_reference: "PO-1"
      }),
      confirmation("c2", "changed", "2026-09-01T12:00:00.000Z"),
      confirmation("other", "rejected", "2026-09-01T13:00:00.000Z", {
        supplier_order_id: "order-2"
      })
    ]
  });

  assert.deepEqual(
    evidence.map((entry) => entry.confirmationId),
    ["c2", "c1"]
  );
  assert.equal(evidence[0]?.status, "changed");
  assert.equal(evidence[1]?.reference, "PO-1");
});

test("confirmation evidence rejects cross-tenant rows", () => {
  assert.throws(
    () =>
      buildSupplierOrderConfirmationEvidence({
        restaurantId: RESTAURANT_ID,
        orderId: ORDER_ID,
        confirmations: [
          confirmation("c1", "acknowledged", "2026-09-01T10:00:00.000Z", {
            restaurant_id: "restaurant-b"
          })
        ]
      }),
    /another restaurant/i
  );
});

test("confirmation client ids are stable for the same order and timestamp", () => {
  assert.equal(
    confirmationClientIdForOrder(ORDER_ID, "2026-09-01T10:00:00.000Z"),
    "mgr-confirm:order-1:2026-09-01T10:00:00.000Z"
  );
});
