import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptInventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  inventoryEventNoteFromMetadata,
  isInventoryAdjustmentReasonCode,
  isInventoryUsageReasonCode,
  validateUsageOrAdjustmentEvidence
} from "../services/domain/inventoryUsageAdjustmentEvidence";

function input(overrides: Partial<InventoryEventInput> = {}): InventoryEventInput {
  return {
    restaurantId: "restaurant-a",
    inventoryItemId: "chicken",
    eventType: "usage",
    quantity: 250,
    canonicalUnit: "g",
    effectiveAt: "2026-07-26T10:00:00.000Z",
    source: "operator_usage",
    sourceReference: null,
    reasonCode: "prep",
    clientEventId: "device-event-usage-1",
    idempotencyKey: "usage:prep:1",
    supersedesEventId: null,
    metadata: { note: "Prep draw-down for lunch" },
    ...overrides
  };
}

function decide(candidate: InventoryEventInput) {
  return acceptInventoryEvent({
    existingEvents: [],
    candidate,
    authority: {
      id: "event-1",
      actorUserId: "manager-1",
      recordedAt: "2026-07-26T10:01:00.000Z"
    }
  });
}

test("usage and adjustment reason allowlists match product writers", () => {
  assert.equal(isInventoryUsageReasonCode("prep"), true);
  assert.equal(isInventoryUsageReasonCode("staff_meal"), true);
  assert.equal(isInventoryUsageReasonCode("waste"), false);
  assert.equal(isInventoryAdjustmentReasonCode("found"), true);
  assert.equal(isInventoryAdjustmentReasonCode("recount_delta"), true);
  assert.equal(isInventoryAdjustmentReasonCode("prep"), false);
});

test("metadata notes reject whitespace-only evidence", () => {
  assert.equal(inventoryEventNoteFromMetadata({ note: "  ok  " }), "ok");
  assert.equal(inventoryEventNoteFromMetadata({ note: "   " }), null);
  assert.equal(inventoryEventNoteFromMetadata({}), null);
  assert.equal(inventoryEventNoteFromMetadata(null), null);
});

test("validateUsageOrAdjustmentEvidence ignores unrelated event types", () => {
  assert.equal(
    validateUsageOrAdjustmentEvidence({
      eventType: "waste",
      reasonCode: null,
      metadata: {}
    }),
    null
  );
  assert.equal(
    validateUsageOrAdjustmentEvidence({
      eventType: "receipt",
      reasonCode: null,
      metadata: {}
    }),
    null
  );
});

test("rejects usage without an allowlisted reason or note", () => {
  assert.equal(decide(input({ reasonCode: null })).status, "rejected");
  assert.equal(
    (decide(input({ reasonCode: null })) as { reason: string }).reason,
    "usage_requires_reason"
  );
  assert.equal(
    (decide(input({ reasonCode: "spoilage" })) as { reason: string }).reason,
    "invalid_usage_reason"
  );
  assert.equal(
    (decide(input({ metadata: {} })) as { reason: string }).reason,
    "usage_requires_note"
  );
  assert.equal(
    (decide(input({ metadata: { note: "   " } })) as { reason: string }).reason,
    "usage_requires_note"
  );
});

test("accepts usage with allowlisted reason and note", () => {
  const result = decide(input());
  assert.equal(result.status, "accepted");
});

test("rejects adjustment without an allowlisted reason or note", () => {
  const base = input({
    eventType: "adjustment",
    quantity: -100,
    source: "operator_adjustment",
    clientEventId: "device-event-adjust-1",
    idempotencyKey: "adjustment:lost:1",
    reasonCode: "lost",
    metadata: { note: "Unexplained loss after investigation" }
  });
  assert.equal(
    (decide({ ...base, reasonCode: null }) as { reason: string }).reason,
    "adjustment_requires_reason"
  );
  assert.equal(
    (decide({ ...base, reasonCode: "spoilage" }) as { reason: string }).reason,
    "invalid_adjustment_reason"
  );
  assert.equal(
    (decide({ ...base, metadata: { note: "" } }) as { reason: string }).reason,
    "adjustment_requires_note"
  );
});

test("accepts adjustment with allowlisted reason and note", () => {
  const result = decide(
    input({
      eventType: "adjustment",
      quantity: 50,
      source: "operator_adjustment",
      clientEventId: "device-event-adjust-2",
      idempotencyKey: "adjustment:found:1",
      reasonCode: "found",
      metadata: { note: "Found stock after walk-in check" }
    })
  );
  assert.equal(result.status, "accepted");
});

test("receipt waste count and stockout still omit usage evidence requirements", () => {
  for (const eventType of ["receipt", "waste", "count", "stockout"] as const) {
    const result = decide(
      input({
        eventType,
        quantity: eventType === "stockout" ? 0 : 100,
        reasonCode: null,
        metadata: {},
        clientEventId: `device-${eventType}`,
        idempotencyKey: `${eventType}:1`,
        source: `operator_${eventType}`
      })
    );
    assert.equal(result.status, "accepted", eventType);
  }
});
