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
      source: "operator_receipt",
      sourceReference: "INV-88",
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
  assert.equal(history[0]!.documentReference, "INV-88");
  assert.equal(history[1]!.syncing, false);
  assert.equal(history[1]!.clientEventId, "client-receipt-1");
  assert.equal(history[1]!.note, "Morning drop");
  assert.equal(history[1]!.documentReference, null);
});

test("mergeDeliveryHistoryEntries surfaces ad-hoc operator document references only", async () => {
  const { record, list } = createInMemoryInventoryEventRecorder({
    actorUserId: "manager-1",
    idFor: (candidate) => `server-${candidate.clientEventId}`,
    now: () => "2026-08-01T09:05:00.000Z"
  });

  await record({
    ...receiptInput,
    source: "operator_receipt",
    sourceReference: "PO-12",
    clientEventId: "client-receipt-doc",
    idempotencyKey: "inventory:client-receipt-doc"
  });
  await record({
    ...receiptInput,
    source: "supplier_delivery",
    sourceReference: "00000000-0000-4000-8000-000000000d01",
    clientEventId: "client-receipt-order",
    idempotencyKey: "inventory:client-receipt-order",
    metadata: {}
  });

  const history = mergeDeliveryHistoryEntries({
    events: list({ restaurantId: "restaurant-a", eventTypes: ["receipt"] }),
    itemNames: { "item-chicken": "Chicken thighs" },
    queued: []
  });

  const adhoc = history.find((entry) => entry.clientEventId === "client-receipt-doc");
  const orderReceive = history.find((entry) => entry.clientEventId === "client-receipt-order");
  assert.equal(adhoc?.documentReference, "PO-12");
  assert.equal(orderReceive?.documentReference, null);
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
