import assert from "node:assert/strict";
import test from "node:test";

import {
  actionOutcomeFromPersistedRow,
  buildSupplierDeliveryOutcomeViews,
  countAttentionSupplierDeliveryOutcomes,
  deliveryOutcomeKind,
  deliveryOutcomeLessonCode,
  filterSupplierDeliveryOutcomeViews,
  isSupplierDeliveryOutcome,
  outcomeLessonForDelivery,
  type PersistedActionOutcomeRow
} from "../services/domain/actionOutcomes";
import {
  buildSupplierOrderDeliveryEvidence,
  type SupplierDeliveryRecord
} from "../services/domain/supplierReliability";
import type { SupplierOrder } from "../types/mise";

const RESTAURANT_ID = "00000000-0000-4000-8000-000000000001";

function persisted(overrides: Partial<PersistedActionOutcomeRow> = {}): PersistedActionOutcomeRow {
  return {
    id: "outcome-1",
    restaurant_id: RESTAURANT_ID,
    action_id: "action-1",
    expected_result: { deliveryStatus: "received" },
    actual_result: {
      deliveryStatus: "discrepancy",
      deliveryId: "delivery-1",
      lineCount: 2
    },
    variance: {
      deliveryStatusMatched: false,
      hasDiscrepancy: true,
      hasPartialReceipt: false
    },
    measured_at: "2026-09-01T12:00:00.000Z",
    lesson: "Review this supplier outcome before using it to adjust supplier reliability.",
    ...overrides
  };
}

function outcome(overrides: Partial<PersistedActionOutcomeRow> = {}) {
  return actionOutcomeFromPersistedRow(persisted(overrides));
}

test("supplier delivery outcomes classify matched and review lessons", () => {
  const matched = outcome({
    actual_result: {
      deliveryStatus: "received",
      deliveryId: "delivery-2",
      lineCount: 1
    },
    variance: { deliveryStatusMatched: true },
    lesson: "The supplier order was received as expected."
  });
  assert.equal(isSupplierDeliveryOutcome(matched), true);
  assert.equal(deliveryOutcomeKind(matched), "matched");
  assert.equal(deliveryOutcomeLessonCode(matched), "matched");

  const review = outcome();
  assert.equal(deliveryOutcomeKind(review), "discrepancy");
  assert.equal(deliveryOutcomeLessonCode(review), "review_reliability");
});

test("delivery outcome views join supplier order presentation fields", () => {
  const order = {
    id: "order-1",
    restaurant_id: RESTAURANT_ID,
    supplier_id: "supplier-1",
    supplier_name: "Metro Produce Supply",
    status: "completed",
    delivery_date: "2026-08-28",
    created_at: "2026-08-27T12:00:00.000Z",
    order_message: "Recorded produce order",
    operator_note: null
  } as SupplierOrder;
  const delivery = {
    id: "delivery-1",
    restaurant_id: RESTAURANT_ID,
    supplier_order_id: order.id,
    status: "discrepancy",
    received_at: "2026-08-28T16:00:00.000Z",
    client_delivery_id: "client-1",
    notes: null,
    created_at: "2026-08-28T16:00:00.000Z"
  } as SupplierDeliveryRecord;

  const views = buildSupplierDeliveryOutcomeViews({
    restaurantId: RESTAURANT_ID,
    outcomes: [outcome()],
    deliveries: [delivery],
    orders: [order]
  });

  assert.equal(views.length, 1);
  assert.equal(views[0]?.supplierName, "Metro Produce Supply");
  assert.equal(views[0]?.supplierOrderId, "order-1");
  assert.equal(views[0]?.kind, "discrepancy");
  assert.equal(filterSupplierDeliveryOutcomeViews(views, "attention").length, 1);
  assert.equal(filterSupplierDeliveryOutcomeViews(views, "all").length, 1);
  assert.equal(countAttentionSupplierDeliveryOutcomes([outcome()]), 1);
  assert.equal(
    countAttentionSupplierDeliveryOutcomes([
      outcome({
        actual_result: {
          deliveryStatus: "received",
          deliveryId: "delivery-matched",
          lineCount: 1
        },
        variance: { deliveryStatusMatched: true },
        lesson: "The supplier order was received as expected."
      })
    ]),
    0
  );
});

test("order delivery evidence attaches append-only outcome lessons", () => {
  const targetOrder = {
    id: "order-1",
    restaurant_id: RESTAURANT_ID,
    supplier_id: "supplier-1",
    supplier_name: "Produce Co.",
    status: "completed",
    delivery_date: "2026-07-10",
    created_at: "2026-07-09T12:00:00.000Z",
    order_message: "Recorded produce order",
    operator_note: null
  } as SupplierOrder;
  const lesson = outcomeLessonForDelivery([outcome()], "delivery-1");
  assert.ok(lesson);
  const evidence = buildSupplierOrderDeliveryEvidence({
    restaurantId: RESTAURANT_ID,
    restaurantTimeZone: "America/New_York",
    order: targetOrder,
    deliveries: [
      {
        id: "delivery-1",
        restaurant_id: RESTAURANT_ID,
        supplier_order_id: targetOrder.id,
        status: "discrepancy",
        received_at: "2026-07-11T15:00:00.000Z",
        client_delivery_id: "client-1",
        notes: null,
        created_at: "2026-07-11T15:00:00.000Z"
      } as SupplierDeliveryRecord
    ],
    items: [],
    outcomesByDeliveryId: new Map([["delivery-1", lesson!]])
  });

  assert.equal(evidence[0]?.outcomeLessonCode, "review_reliability");
  assert.equal(evidence[0]?.outcomeKind, "discrepancy");
  assert.equal(evidence[0]?.outcomeLessonText, null);
});
