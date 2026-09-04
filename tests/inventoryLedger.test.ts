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
      quantity: -1000,
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
      quantity: -1000,
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

test("rejects linked corrections that do not exactly reverse the superseded movement", () => {
  const receipt = accepted([], input(), "event-1");
  const waste = accepted(
    [receipt],
    input({
      eventType: "waste",
      quantity: 250,
      clientEventId: "waste-1",
      idempotencyKey: "waste-1"
    }),
    "event-2"
  );
  const mismatch = acceptInventoryEvent({
    existingEvents: [receipt, waste],
    candidate: input({
      eventType: "correction",
      quantity: 100,
      clientEventId: "bad-correction",
      idempotencyKey: "bad-correction",
      supersedesEventId: "event-2"
    }),
    authority: {
      id: "event-3",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:03:00.000Z"
    }
  });
  assert.equal(mismatch.status, "rejected");
  if (mismatch.status === "rejected") {
    assert.equal(mismatch.reason, "correction_quantity_mismatch");
  }

  const count = accepted(
    [],
    input({
      eventType: "count",
      quantity: 500,
      clientEventId: "count-target",
      idempotencyKey: "count-target"
    }),
    "count-1"
  );
  const againstCount = acceptInventoryEvent({
    existingEvents: [count],
    candidate: input({
      eventType: "correction",
      quantity: -500,
      clientEventId: "count-correction",
      idempotencyKey: "count-correction",
      supersedesEventId: "count-1"
    }),
    authority: {
      id: "event-4",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:04:00.000Z"
    }
  });
  assert.equal(againstCount.status, "rejected");
  if (againstCount.status === "rejected") {
    assert.equal(againstCount.reason, "correction_target_not_reversible");
  }

  const unitMismatch = acceptInventoryEvent({
    existingEvents: [receipt, waste],
    candidate: input({
      eventType: "correction",
      quantity: 250,
      canonicalUnit: "ml",
      clientEventId: "unit-correction",
      idempotencyKey: "unit-correction",
      supersedesEventId: "event-2"
    }),
    authority: {
      id: "event-5",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:05:00.000Z"
    }
  });
  assert.equal(unitMismatch.status, "rejected");
  if (unitMismatch.status === "rejected") {
    assert.equal(unitMismatch.reason, "correction_unit_mismatch");
  }

  const restored = accepted(
    [receipt, waste],
    input({
      eventType: "correction",
      quantity: 250,
      clientEventId: "waste-correction",
      idempotencyKey: "waste-correction",
      supersedesEventId: "event-2"
    }),
    "event-6"
  );
  assert.equal(restored.quantity, 250);
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
      quantity: -1000,
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
    quantity: 1600,
    lastSequence: 4,
    conflicts: []
  });
});
