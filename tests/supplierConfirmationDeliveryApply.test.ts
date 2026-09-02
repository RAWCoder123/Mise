import assert from "node:assert/strict";
import test from "node:test";

import {
  deliveryDateKeyFromConfirmationAt,
  proposeSupplierConfirmationDeliveryApply,
  selectConfirmationDeliveryApplyCandidate,
  type SupplierOrderConfirmationRecord
} from "../services/domain/supplierConfirmationDeliveryApply";

const baseConfirmation = (
  overrides: Partial<SupplierOrderConfirmationRecord> = {}
): SupplierOrderConfirmationRecord => ({
  id: "conf-1",
  restaurant_id: "rest-a",
  supplier_order_id: "order-1",
  confirmation_status: "changed",
  confirmation_reference: "REF-1",
  expected_delivery_at: "2026-09-05T15:00:00.000Z",
  received_at: "2026-09-02T12:00:00.000Z",
  source: "manager_manual",
  idempotency_key: "manager_confirmation:client-1",
  created_at: "2026-09-02T12:00:00.000Z",
  ...overrides
});

test("confirmation timestamps convert to restaurant calendar delivery dates", () => {
  assert.equal(
    deliveryDateKeyFromConfirmationAt("2026-09-05T15:00:00.000Z", "UTC"),
    "2026-09-05"
  );
  assert.equal(deliveryDateKeyFromConfirmationAt("", "UTC"), null);
  assert.equal(deliveryDateKeyFromConfirmationAt("not-a-date", "UTC"), null);
});

test("apply proposal accepts changed confirmations on sent orders with a new date", () => {
  const proposal = proposeSupplierConfirmationDeliveryApply({
    restaurantId: "rest-a",
    orderId: "order-1",
    orderStatus: "sent",
    currentDeliveryDate: "2026-09-03",
    timeZone: "UTC",
    confirmation: baseConfirmation()
  });
  assert.equal(proposal.ok, true);
  if (proposal.ok) {
    assert.equal(proposal.deliveryDate, "2026-09-05");
    assert.equal(proposal.previousDeliveryDate, "2026-09-03");
    assert.equal(proposal.confirmationId, "conf-1");
  }
});

test("apply proposal refuses rejected, draft, cross-tenant, and already-applied cases", () => {
  assert.equal(
    proposeSupplierConfirmationDeliveryApply({
      restaurantId: "rest-a",
      orderId: "order-1",
      orderStatus: "sent",
      currentDeliveryDate: "2026-09-05",
      timeZone: "UTC",
      confirmation: baseConfirmation()
    }).ok,
    false
  );
  assert.equal(
    (
      proposeSupplierConfirmationDeliveryApply({
        restaurantId: "rest-a",
        orderId: "order-1",
        orderStatus: "draft",
        currentDeliveryDate: "2026-09-03",
        timeZone: "UTC",
        confirmation: baseConfirmation()
      }) as { reason: string }
    ).reason,
    "order_not_sent"
  );
  assert.equal(
    (
      proposeSupplierConfirmationDeliveryApply({
        restaurantId: "rest-a",
        orderId: "order-1",
        orderStatus: "sent",
        currentDeliveryDate: "2026-09-03",
        timeZone: "UTC",
        confirmation: baseConfirmation({ confirmation_status: "rejected" })
      }) as { reason: string }
    ).reason,
    "rejected_or_unverified"
  );
  assert.equal(
    (
      proposeSupplierConfirmationDeliveryApply({
        restaurantId: "rest-b",
        orderId: "order-1",
        orderStatus: "sent",
        currentDeliveryDate: "2026-09-03",
        timeZone: "UTC",
        confirmation: baseConfirmation()
      }) as { reason: string }
    ).reason,
    "cross_tenant"
  );
});

test("candidate selection prefers the latest applicable confirmation", () => {
  const candidate = selectConfirmationDeliveryApplyCandidate({
    restaurantId: "rest-a",
    orderId: "order-1",
    orderStatus: "sent",
    currentDeliveryDate: "2026-09-03",
    timeZone: "UTC",
    confirmations: [
      baseConfirmation({
        id: "older",
        received_at: "2026-09-01T12:00:00.000Z",
        expected_delivery_at: "2026-09-04T15:00:00.000Z"
      }),
      baseConfirmation({
        id: "newer",
        received_at: "2026-09-02T18:00:00.000Z",
        expected_delivery_at: "2026-09-06T15:00:00.000Z"
      }),
      baseConfirmation({
        id: "rejected",
        confirmation_status: "rejected",
        received_at: "2026-09-03T01:00:00.000Z",
        expected_delivery_at: "2026-09-07T15:00:00.000Z"
      })
    ]
  });
  assert.ok(candidate);
  assert.equal(candidate?.confirmationId, "newer");
  assert.equal(candidate?.proposedDeliveryDate, "2026-09-06");
});
