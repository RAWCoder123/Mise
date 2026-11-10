import assert from "node:assert/strict";
import test from "node:test";

import { mergeDeliveryHistoryEntries } from "../services/application/deliveryHistoryMerge";
import { createInMemoryInventoryEventRecorder } from "../services/domain/inventoryEventTransport";
import type { InventoryEventInput } from "../services/domain/inventoryLedger";
import { createInventoryOutboxEntry } from "../services/domain/inventoryOutbox";

const receiptInput: InventoryEventInput = {
  restaurantId: "restaurant-a",
  inventoryItemId: "item-chicken",
  eventType: "receipt",
  quantity: 2500,
  canonicalUnit: "g",
  effectiveAt: "2026-08-01T09:00:00.000Z",
  source: "receiving",
  sourceReference: null,
  reasonCode: null,
  clientEventId: "client-receipt-1",
  idempotencyKey: "inventory:client-receipt-1",
  supersedesEventId: null,
  metadata: { note: "Morning drop" }
};

test("in-memory inventory event recorder lists accepted events", async () => {
  const { record, list } = createInMemoryInventoryEventRecorder({
    actorUserId: "manager-1",
    idFor: (candidate) => `server-${candidate.clientEventId}`,
    now: () => "2026-08-01T09:05:00.000Z"
  });

  await record(receiptInput);
  await record({
    ...receiptInput,
    eventType: "waste",
    clientEventId: "client-waste-1",
    idempotencyKey: "inventory:client-waste-1",
    quantity: 100,
    metadata: {}
  });

  const receipts = list({
    restaurantId: "restaurant-a",
    eventTypes: ["receipt"],
    limit: 10
  });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]!.clientEventId, "client-receipt-1");
});

test("list path prefers newest recorded_at ordering", async () => {
  let tick = 0;
  const stamps = ["2026-08-01T08:00:00.000Z", "2026-08-01T11:00:00.000Z"];
  const { record, list } = createInMemoryInventoryEventRecorder({
    actorUserId: "manager-1",
    idFor: (candidate) => `server-${candidate.clientEventId}`,
    now: () => stamps[tick++] ?? "2026-08-01T12:00:00.000Z"
  });

  await record({
    ...receiptInput,
    clientEventId: "older",
    idempotencyKey: "inventory:older",
    effectiveAt: "2026-08-01T07:00:00.000Z"
  });
  await record({
    ...receiptInput,
    clientEventId: "newer",
    idempotencyKey: "inventory:newer",
    effectiveAt: "2026-08-01T10:30:00.000Z"
  });

  const listed = list({ restaurantId: "restaurant-a", eventTypes: ["receipt"] });
  assert.equal(listed[0]!.clientEventId, "newer");
  assert.equal(listed[1]!.clientEventId, "older");
});

test("mergeDeliveryHistoryEntries includes pending outbox receipts as syncing", async () => {
  const { record, list } = createInMemoryInventoryEventRecorder({
    actorUserId: "manager-1",
    idFor: (candidate) => `server-${candidate.clientEventId}`,
    now: () => "2026-08-01T09:05:00.000Z"
  });
  await record(receiptInput);
  const events = list({ restaurantId: "restaurant-a", eventTypes: ["receipt"] });

  const pending = createInventoryOutboxEntry({
    id: "outbox-pending-1",
    event: {
      ...receiptInput,
      clientEventId: "client-receipt-pending",
      idempotencyKey: "inventory:client-receipt-pending",
      effectiveAt: "2026-08-01T10:00:00.000Z",
      metadata: { note: "Still syncing" }
    },
    now: "2026-08-01T10:00:01.000Z"
  });

  const history = mergeDeliveryHistoryEntries({
    events,
    itemNames: new Map([["item-chicken", "Chicken thighs"]]),
    queued: [pending]
  });

  assert.equal(history.length, 2);
  assert.equal(history[0]!.syncing, true);
  assert.equal(history[0]!.itemName, "Chicken thighs");
  assert.equal(history[0]!.note, "Still syncing");
  assert.equal(history[0]!.sourceKind, "other");
  assert.equal(history[0]!.supplierName, null);
  assert.equal(history[1]!.syncing, false);
  assert.equal(history[1]!.clientEventId, "client-receipt-1");
  assert.equal(history[1]!.note, "Morning drop");
  assert.equal(history[1]!.sourceKind, "other");
  assert.equal(history[1]!.supplierName, null);
});

test("mergeDeliveryHistoryEntries preserves operator and supplier receipt sources", async () => {
  const { record, list } = createInMemoryInventoryEventRecorder({
    actorUserId: "manager-1",
    idFor: (candidate) => `server-${candidate.clientEventId}`,
    now: () => "2026-08-01T09:05:00.000Z"
  });

  await record({
    ...receiptInput,
    source: "operator_receipt",
    clientEventId: "client-operator",
    idempotencyKey: "inventory:client-operator",
    effectiveAt: "2026-08-01T08:00:00.000Z",
    metadata: { note: "Walk-in cooler drop" }
  });
  await record({
    ...receiptInput,
    source: "supplier_delivery",
    clientEventId: "client-order",
    idempotencyKey: "inventory:client-order",
    effectiveAt: "2026-08-01T11:00:00.000Z",
    metadata: {
      supplierName: "Fresh Poultry Supply",
      supplierOrderId: "order-1",
      note: "As ordered"
    }
  });

  const events = list({ restaurantId: "restaurant-a", eventTypes: ["receipt"] });
  const history = mergeDeliveryHistoryEntries({
    events,
    itemNames: new Map([["item-chicken", "Chicken thighs"]]),
    queued: []
  });

  assert.equal(history.length, 2);
  assert.equal(history[0]!.sourceKind, "supplier_delivery");
  assert.equal(history[0]!.supplierName, "Fresh Poultry Supply");
  assert.equal(history[0]!.note, "As ordered");
  assert.equal(history[1]!.sourceKind, "operator_receipt");
  assert.equal(history[1]!.supplierName, null);
  assert.equal(history[1]!.note, "Walk-in cooler drop");
});

test("mergeDeliveryHistoryEntries dedupes pending entries already accepted", async () => {
  const { record, list } = createInMemoryInventoryEventRecorder({
    actorUserId: "manager-1",
    idFor: (candidate) => `server-${candidate.clientEventId}`,
    now: () => "2026-08-01T09:05:00.000Z"
  });
  await record(receiptInput);
  const events = list({ restaurantId: "restaurant-a", eventTypes: ["receipt"] });

  const alreadyAccepted = createInventoryOutboxEntry({
    id: "outbox-accepted-dup",
    event: receiptInput,
    now: "2026-08-01T09:00:01.000Z"
  });

  const history = mergeDeliveryHistoryEntries({
    events,
    itemNames: { "item-chicken": "Chicken thighs" },
    queued: [alreadyAccepted]
  });

  assert.equal(history.length, 1);
  assert.equal(history[0]!.syncing, false);
  assert.equal(history[0]!.clientEventId, "client-receipt-1");
});
