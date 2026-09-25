import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptInventoryEvent,
  projectInventoryEvents,
  type InventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "receiving",
    sourceReference: "delivery-1",
    reasonCode: null,
    clientEventId: "device-event-1",
    idempotencyKey: "receiving:delivery-1:chicken",
    supersedesEventId: null,
    metadata: {},
    ...overrides
  };
}

function accepted(
  existingEvents: readonly InventoryEvent[],
  candidate: InventoryEventInput,
  id: string
) {
  const result = acceptInventoryEvent({
    existingEvents,
    candidate,
    authority: {
      id,
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:01:00.000Z"
    }
  });
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") throw new Error("Expected accepted event");
  return result.event;
}

test("accepts an event once and deduplicates an identical offline replay", () => {
  const first = accepted([], input(), "event-1");
  const replay = acceptInventoryEvent({
    existingEvents: [first],
    candidate: input(),
    authority: {
      id: "event-2",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:02:00.000Z"
    }
  });
  assert.equal(replay.status, "duplicate");
  if (replay.status === "duplicate") assert.equal(replay.event.id, "event-1");
});

test("surfaces an idempotency conflict instead of overwriting the first event", () => {
  const first = accepted([], input(), "event-1");
  const conflict = acceptInventoryEvent({
    existingEvents: [first],
    candidate: input({ quantity: 2000 }),
    authority: {
      id: "event-2",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:02:00.000Z"
    }
  });
  assert.equal(conflict.status, "conflict");
});

test("requires corrections to supersede a same-tenant, same-item event once", () => {
  const receipt = accepted([], input(), "event-1");
  const correction = accepted(
    [receipt],
    input({
      eventType: "correction",
      quantity: -100,
      clientEventId: "device-event-2",
      idempotencyKey: "correction:event-1",
      supersedesEventId: "event-1"
    }),
    "event-2"
  );
  const secondCorrection = acceptInventoryEvent({
    existingEvents: [receipt, correction],
    candidate: input({
      eventType: "correction",
      quantity: -50,
      clientEventId: "device-event-3",
      idempotencyKey: "correction:event-1:again",
      supersedesEventId: "event-1"
    }),
    authority: {
      id: "event-3",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:03:00.000Z"
    }
  });
  assert.equal(secondCorrection.status, "conflict");
});

test("projects counts, receipts, usage, waste, and corrections in server sequence", () => {
  const count = accepted(
    [],
    input({
      eventType: "count",
      quantity: 2000,
      clientEventId: "count-1",
      idempotencyKey: "count-1"
    }),
    "event-1"
  );
  const receipt = accepted(
    [count],
    input({ clientEventId: "receipt-1", idempotencyKey: "receipt-1" }),
    "event-2"
  );
  const usage = accepted(
    [count, receipt],
    input({
      eventType: "usage",
      quantity: 400,
      clientEventId: "usage-1",
      idempotencyKey: "usage-1"
    }),
    "event-3"
  );
  const correction = accepted(
    [count, receipt, usage],
    input({
      eventType: "correction",
      quantity: -100,
      clientEventId: "correction-1",
      idempotencyKey: "correction-1",
      supersedesEventId: "event-2"
    }),
    "event-4"
  );
  assert.deepEqual(projectInventoryEvents("restaurant-a", "chicken", [
    correction,
    usage,
    count,
    receipt
  ]), {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    canonicalUnit: "g",
    quantity: 2500,
    lastSequence: 4,
    conflicts: []
  });
});

test("projectInventoryEvents skips rows stamped projectionApplied false", () => {
  const count = accepted(
    [],
    input({
      eventType: "count",
      quantity: 2000,
      clientEventId: "count-1",
      idempotencyKey: "count-1"
    }),
    "event-1"
  );
  const delayedReceipt = {
    ...accepted(
      [count],
      input({
        quantity: 500,
        effectiveAt: "2026-07-26T09:00:00.000Z",
        clientEventId: "receipt-delayed",
        idempotencyKey: "receipt-delayed"
      }),
      "event-2"
    ),
    projectionApplied: false as const
  };
  const delayedWaste = {
    ...accepted(
      [count, delayedReceipt],
      input({
        eventType: "waste" as const,
        quantity: 400,
        effectiveAt: "2026-07-26T08:00:00.000Z",
        clientEventId: "waste-delayed",
        idempotencyKey: "waste-delayed"
      }),
      "event-3"
    ),
    projectionApplied: false as const
  };

  assert.deepEqual(projectInventoryEvents("restaurant-a", "chicken", [
    delayedWaste,
    delayedReceipt,
    count
  ]), {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    canonicalUnit: "g",
    quantity: 2000,
    lastSequence: 3,
    conflicts: []
  });
});

test("projectInventoryEvents still applies legacy rows without projectionApplied", () => {
  const count = accepted(
    [],
    input({
      eventType: "count",
      quantity: 2000,
      clientEventId: "count-1",
      idempotencyKey: "count-1"
    }),
    "event-1"
  );
  const legacyReceipt = accepted(
    [count],
    input({
      quantity: 500,
      effectiveAt: "2026-07-26T09:00:00.000Z",
      clientEventId: "receipt-legacy",
      idempotencyKey: "receipt-legacy"
    }),
    "event-2"
  );
  assert.equal(
    projectInventoryEvents("restaurant-a", "chicken", [count, legacyReceipt]).quantity,
    2500
  );
});
