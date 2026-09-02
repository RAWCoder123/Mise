import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptInventoryEvent,
  projectInventoryEvents,
  type InventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  buildReceiptCorrectionCandidate,
  findCorrectableReceiptEvent,
  listCorrectableOperatorReceipts
} from "../services/domain/receiptCorrection";
import {
  requireInventoryOperation,
  requireReceiptCorrectionInput
} from "../services/miseValidation";

const restaurantId = "restaurant-a";

function receiptEvent(overrides: Partial<InventoryEvent> = {}): InventoryEvent {
  return {
    id: "receipt-1",
    sequence: 2,
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-09-02T16:00:00.000Z",
    recordedAt: "2026-09-02T16:00:02.000Z",
    actorUserId: "manager-1",
    source: "operator_receipt",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "client-receipt-1",
    idempotencyKey: "inventory:receipt-1",
    supersedesEventId: null,
    metadata: { note: "Walk-in delivery" },
    ...overrides
  };
}

test("requireInventoryOperation still blocks generic correction links", () => {
  assert.throws(
    () =>
      requireInventoryOperation({
        restaurantId,
        inventoryItemId: "tomatoes",
        eventType: "correction",
        quantity: -1000,
        canonicalUnit: "g",
        effectiveAt: "2026-09-02T17:00:00.000Z"
      }),
    /supported inventory operation/
  );
});

test("requireReceiptCorrectionInput requires a bounded note and receipt id", () => {
  const validated = requireReceiptCorrectionInput({
    restaurantId,
    receiptEventId: "receipt-1",
    note: " Logged wrong item ",
    effectiveAt: "2026-09-02T17:00:00.000Z"
  });
  assert.equal(validated.note, "Logged wrong item");
  assert.equal(validated.receiptEventId, "receipt-1");
  assert.throws(
    () =>
      requireReceiptCorrectionInput({
        restaurantId,
        receiptEventId: "receipt-1",
        note: "   "
      }),
    /correction note/
  );
  assert.throws(
    () =>
      requireReceiptCorrectionInput({
        restaurantId,
        receiptEventId: "",
        note: "Mistake"
      }),
    /receipt record/
  );
});

test("buildReceiptCorrectionCandidate reverses the exact receipt quantity", () => {
  const candidate = buildReceiptCorrectionCandidate({
    receiptEvent: receiptEvent(),
    restaurantId,
    note: "Logged against the wrong item",
    effectiveAt: "2026-09-02T17:00:00.000Z"
  });
  assert.equal(candidate.eventType, "correction");
  assert.equal(candidate.quantity, -1000);
  assert.equal(candidate.supersedesEventId, "receipt-1");
  assert.equal(candidate.source, "operator_correction");
  assert.equal(candidate.reasonCode, "receipt_correction");
  assert.equal(candidate.sourceReference, "receipt-1");
  assert.equal(candidate.metadata.note, "Logged against the wrong item");
  assert.equal(candidate.metadata.corrected_event_type, "receipt");
  assert.throws(
    () =>
      buildReceiptCorrectionCandidate({
        receiptEvent: receiptEvent({ eventType: "waste" }),
        restaurantId,
        note: "Nope",
        effectiveAt: "2026-09-02T17:00:00.000Z"
      }),
    /Only receipt/
  );
  assert.throws(
    () =>
      buildReceiptCorrectionCandidate({
        receiptEvent: receiptEvent({ source: "supplier_delivery" }),
        restaurantId,
        note: "Nope",
        effectiveAt: "2026-09-02T17:00:00.000Z"
      }),
    /manual Log Delivery/
  );
  assert.throws(
    () =>
      buildReceiptCorrectionCandidate({
        receiptEvent: receiptEvent({ restaurantId: "restaurant-b" }),
        restaurantId,
        note: "Nope",
        effectiveAt: "2026-09-02T17:00:00.000Z"
      }),
    /cross-restaurant/
  );
});

test("findCorrectableReceiptEvent fails closed once a correction already exists", () => {
  const receipt = receiptEvent();
  const found = findCorrectableReceiptEvent({
    restaurantId,
    receiptEventId: receipt.id,
    events: [receipt]
  });
  assert.equal(found.id, receipt.id);

  assert.throws(
    () =>
      findCorrectableReceiptEvent({
        restaurantId,
        receiptEventId: receipt.id,
        events: [
          receipt,
          receiptEvent({
            id: "correction-1",
            sequence: 3,
            eventType: "correction",
            quantity: -1000,
            source: "operator_correction",
            supersedesEventId: receipt.id,
            clientEventId: "client-correction-1",
            idempotencyKey: "receipt_correction:receipt-1"
          })
        ]
      }),
    /already corrected/
  );

  assert.throws(
    () =>
      findCorrectableReceiptEvent({
        restaurantId,
        receiptEventId: receipt.id,
        events: [receiptEvent({ source: "supplier_delivery" })]
      }),
    /manual Log Delivery/
  );
});

test("listCorrectableOperatorReceipts excludes supplier deliveries and corrected rows", () => {
  const operator = receiptEvent();
  const supplier = receiptEvent({
    id: "receipt-supplier",
    sequence: 3,
    source: "supplier_delivery",
    clientEventId: "client-supplier-1",
    idempotencyKey: "inventory:supplier-1"
  });
  const alreadyCorrected = receiptEvent({
    id: "receipt-2",
    sequence: 4,
    clientEventId: "client-receipt-2",
    idempotencyKey: "inventory:receipt-2"
  });
  const correction = receiptEvent({
    id: "correction-2",
    sequence: 5,
    eventType: "correction",
    quantity: -1000,
    source: "operator_correction",
    supersedesEventId: alreadyCorrected.id,
    clientEventId: "client-correction-2",
    idempotencyKey: "receipt_correction:receipt-2"
  });

  const listed = listCorrectableOperatorReceipts([
    operator,
    supplier,
    alreadyCorrected,
    correction
  ]);
  assert.deepEqual(
    listed.map((event) => event.id),
    [operator.id]
  );
});

test("accepted receipt correction restores projection by reversing the receipt", () => {
  const count: InventoryEventInput = {
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "count",
    quantity: 2000,
    canonicalUnit: "g",
    effectiveAt: "2026-09-02T10:00:00.000Z",
    source: "operator_count",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "count-1",
    idempotencyKey: "inventory:count-1",
    supersedesEventId: null,
    metadata: {}
  };
  const countAccepted = acceptInventoryEvent({
    existingEvents: [],
    candidate: count,
    authority: {
      id: "event-count",
      actorUserId: "manager-1",
      recordedAt: "2026-09-02T10:00:01.000Z"
    }
  });
  assert.equal(countAccepted.status, "accepted");
  if (countAccepted.status !== "accepted") throw new Error("expected count");

  const receiptInput: InventoryEventInput = {
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "receipt",
    quantity: 1000,
    canonicalUnit: "g",
    effectiveAt: "2026-09-02T16:00:00.000Z",
    source: "operator_receipt",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "receipt-1",
    idempotencyKey: "inventory:receipt-1",
    supersedesEventId: null,
    metadata: { note: "Walk-in" }
  };
  const receiptAccepted = acceptInventoryEvent({
    existingEvents: [countAccepted.event],
    candidate: receiptInput,
    authority: {
      id: "event-receipt",
      actorUserId: "manager-1",
      recordedAt: "2026-09-02T16:00:02.000Z"
    }
  });
  assert.equal(receiptAccepted.status, "accepted");
  if (receiptAccepted.status !== "accepted") throw new Error("expected receipt");

  const afterReceipt = projectInventoryEvents(restaurantId, "tomatoes", [
    countAccepted.event,
    receiptAccepted.event
  ]);
  assert.equal(afterReceipt.quantity, 3000);

  const candidate = buildReceiptCorrectionCandidate({
    receiptEvent: receiptAccepted.event,
    restaurantId,
    note: "Duplicate log",
    effectiveAt: "2026-09-02T17:00:00.000Z"
  });
  const correctionAccepted = acceptInventoryEvent({
    existingEvents: [countAccepted.event, receiptAccepted.event],
    candidate: {
      ...candidate,
      clientEventId: "correction-1",
      idempotencyKey: "receipt_correction:event-receipt:correction-1"
    },
    authority: {
      id: "event-correction",
      actorUserId: "manager-1",
      recordedAt: "2026-09-02T17:00:01.000Z"
    }
  });
  assert.equal(correctionAccepted.status, "accepted");
  if (correctionAccepted.status !== "accepted") throw new Error("expected correction");

  const afterCorrection = projectInventoryEvents(restaurantId, "tomatoes", [
    countAccepted.event,
    receiptAccepted.event,
    correctionAccepted.event
  ]);
  assert.equal(afterCorrection.quantity, 2000);

  const secondAttempt = acceptInventoryEvent({
    existingEvents: [
      countAccepted.event,
      receiptAccepted.event,
      correctionAccepted.event
    ],
    candidate: {
      ...candidate,
      clientEventId: "correction-2",
      idempotencyKey: "receipt_correction:event-receipt:correction-2"
    },
    authority: {
      id: "event-correction-2",
      actorUserId: "manager-1",
      recordedAt: "2026-09-02T17:05:00.000Z"
    }
  });
  assert.equal(secondAttempt.status, "conflict");
  if (secondAttempt.status === "conflict") {
    assert.equal(secondAttempt.reason, "event_already_superseded");
  }
});
