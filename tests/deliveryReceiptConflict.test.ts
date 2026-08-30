import assert from "node:assert/strict";
import test from "node:test";

import {
  findManualReceiptConflictsForOrderReceive,
  findOpenSentOrderConflictsForInventoryItem,
  MANUAL_RECEIPT_SOURCE,
  SUPPLIER_DELIVERY_RECEIPT_SOURCE
} from "../services/domain/deliveryReceiptConflict";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { InventoryOutboxEntry } from "../services/domain/inventoryOutbox";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";

function order(overrides: Partial<SupplierOrder> = {}): SupplierOrder {
  return {
    id: "order-1",
    restaurant_id: "restaurant-a",
    supplier_id: "supplier-1",
    supplier_name: "Local Produce Co.",
    order_message: "Order draft",
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-31",
    created_at: "2026-08-28T10:00:00.000Z",
    ...overrides
  };
}

function recommendation(overrides: Partial<PurchaseRecommendation> = {}): PurchaseRecommendation {
  return {
    id: "rec-1",
    restaurant_id: "restaurant-a",
    inventory_item_id: "item-tomatoes",
    item_name: "Roma Tomatoes",
    supplier_id: "supplier-1",
    supplier_name: "Local Produce Co.",
    recommended_quantity: 20,
    unit: "lb",
    reason: "Low stock",
    urgency: "high",
    status: "ordered",
    supplier_order_id: "order-1",
    created_at: "2026-08-28T10:00:00.000Z",
    ...overrides
  };
}

function receiptEvent(overrides: Partial<InventoryEvent> = {}): InventoryEvent {
  return {
    id: "event-1",
    sequence: 1,
    restaurantId: "restaurant-a",
    inventoryItemId: "item-tomatoes",
    eventType: "receipt",
    quantity: 12,
    canonicalUnit: "each",
    effectiveAt: "2026-08-29T14:00:00.000Z",
    recordedAt: "2026-08-29T14:00:01.000Z",
    actorUserId: "user-1",
    source: MANUAL_RECEIPT_SOURCE,
    sourceReference: null,
    reasonCode: null,
    clientEventId: "client-1",
    idempotencyKey: "inventory:client-1",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

test("findOpenSentOrderConflictsForInventoryItem returns sent orders that include the item", () => {
  const conflicts = findOpenSentOrderConflictsForInventoryItem({
    restaurantId: "restaurant-a",
    inventoryItemId: "item-tomatoes",
    orders: [
      order(),
      order({ id: "order-draft", status: "draft" }),
      order({ id: "order-other-tenant", restaurant_id: "restaurant-b" })
    ],
    recommendations: [
      recommendation(),
      recommendation({
        id: "rec-2",
        inventory_item_id: "item-onions",
        supplier_order_id: "order-1"
      }),
      recommendation({
        id: "rec-draft",
        supplier_order_id: "order-draft"
      })
    ]
  });

  assert.deepEqual(conflicts, [
    {
      orderId: "order-1",
      supplierName: "Local Produce Co.",
      inventoryItemId: "item-tomatoes",
      recommendationId: "rec-1"
    }
  ]);
});

test("findOpenSentOrderConflictsForInventoryItem ignores completed orders and wrong items", () => {
  const conflicts = findOpenSentOrderConflictsForInventoryItem({
    restaurantId: "restaurant-a",
    inventoryItemId: "item-tomatoes",
    orders: [order({ status: "completed" })],
    recommendations: [recommendation()]
  });
  assert.deepEqual(conflicts, []);
});

test("findOpenSentOrderConflictsForInventoryItem dedupes multiple recommendations on one order", () => {
  const conflicts = findOpenSentOrderConflictsForInventoryItem({
    restaurantId: "restaurant-a",
    inventoryItemId: "item-tomatoes",
    orders: [order()],
    recommendations: [
      recommendation({ id: "rec-a", status: "approved" }),
      recommendation({ id: "rec-b", status: "ordered" })
    ]
  });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.orderId, "order-1");
});

test("findManualReceiptConflictsForOrderReceive flags operator receipts on linked items", () => {
  const conflicts = findManualReceiptConflictsForOrderReceive({
    restaurantId: "restaurant-a",
    order: order(),
    recommendations: [recommendation()],
    events: [
      receiptEvent(),
      receiptEvent({
        id: "event-supplier",
        source: SUPPLIER_DELIVERY_RECEIPT_SOURCE,
        clientEventId: "client-supplier"
      }),
      receiptEvent({
        id: "event-other-item",
        inventoryItemId: "item-onions",
        clientEventId: "client-onions"
      }),
      receiptEvent({
        id: "event-other-tenant",
        restaurantId: "restaurant-b",
        clientEventId: "client-b"
      })
    ]
  });

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.eventId, "event-1");
  assert.equal(conflicts[0]?.source, MANUAL_RECEIPT_SOURCE);
  assert.equal(conflicts[0]?.syncing, false);
});

test("findManualReceiptConflictsForOrderReceive includes pending outbox operator receipts", () => {
  const queued: InventoryOutboxEntry[] = [
    {
      id: "outbox-1",
      event: {
        restaurantId: "restaurant-a",
        inventoryItemId: "item-tomatoes",
        eventType: "receipt",
        quantity: 4,
        canonicalUnit: "each",
        effectiveAt: "2026-08-29T15:00:00.000Z",
        source: MANUAL_RECEIPT_SOURCE,
        sourceReference: null,
        reasonCode: null,
        clientEventId: "client-pending",
        idempotencyKey: "inventory:client-pending",
        supersedesEventId: null,
        metadata: {}
      },
      status: "pending",
      attemptCount: 0,
      createdAt: "2026-08-29T15:00:00.000Z",
      updatedAt: "2026-08-29T15:00:00.000Z",
      nextAttemptAt: null,
      authoritativeEvent: null,
      resolutionReason: null
    }
  ];

  const conflicts = findManualReceiptConflictsForOrderReceive({
    restaurantId: "restaurant-a",
    order: order(),
    recommendations: [recommendation()],
    events: [],
    queued
  });

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.syncing, true);
  assert.equal(conflicts[0]?.quantity, 4);
});

test("findManualReceiptConflictsForOrderReceive ignores draft and completed orders", () => {
  assert.deepEqual(
    findManualReceiptConflictsForOrderReceive({
      restaurantId: "restaurant-a",
      order: order({ status: "draft" }),
      recommendations: [recommendation()],
      events: [receiptEvent()]
    }),
    []
  );
  assert.deepEqual(
    findManualReceiptConflictsForOrderReceive({
      restaurantId: "restaurant-a",
      order: order({ status: "completed" }),
      recommendations: [recommendation()],
      events: [receiptEvent()]
    }),
    []
  );
});
