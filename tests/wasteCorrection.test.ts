import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptInventoryEvent,
  projectInventoryEvents,
  type InventoryEvent,
  type InventoryEventInput
} from "../services/domain/inventoryLedger";
import {
  buildWasteCorrectionCandidate,
  findCorrectableWasteEvent
} from "../services/domain/wasteCorrection";
import { buildWasteAnalysis } from "../services/domain/wasteAnalysis";
import { requireInventoryOperation, requireWasteCorrectionInput } from "../services/miseValidation";
import type { InventoryItem } from "../types/mise";

const restaurantId = "restaurant-a";

function wasteEvent(overrides: Partial<InventoryEvent> = {}): InventoryEvent {
  return {
    id: "waste-1",
    sequence: 2,
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "waste",
    quantity: 500,
    canonicalUnit: "g",
    effectiveAt: "2026-08-03T16:00:00.000Z",
    recordedAt: "2026-08-03T16:00:02.000Z",
    actorUserId: "manager-1",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "client-waste-1",
    idempotencyKey: "inventory:waste-1",
    supersedesEventId: null,
    metadata: { note: "Trim loss" },
    ...overrides
  };
}

function item(): InventoryItem {
  return {
    id: "tomatoes",
    restaurant_id: restaurantId,
    item_name: "Roma tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 8,
    estimated_unit_cost: 2.5,
    supplier_id: "10000000-0000-4000-8000-000000000013",
    supplier_name: "Supplier",
    last_updated: "2026-08-03T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 1000,
    canonical_unit_verification_status: "verified"
  };
}

test("requireInventoryOperation still blocks generic correction links", () => {
  assert.throws(
    () =>
      requireInventoryOperation({
        restaurantId,
        inventoryItemId: "tomatoes",
        eventType: "correction",
        quantity: 500,
        canonicalUnit: "g",
        effectiveAt: "2026-08-03T17:00:00.000Z"
      }),
    /supported inventory operation/
  );
});

test("requireWasteCorrectionInput requires a bounded note and waste id", () => {
  const validated = requireWasteCorrectionInput({
    restaurantId,
    wasteEventId: "waste-1",
    note: " Logged wrong item ",
    effectiveAt: "2026-08-03T17:00:00.000Z"
  });
  assert.equal(validated.note, "Logged wrong item");
  assert.equal(validated.wasteEventId, "waste-1");
  assert.throws(
    () =>
      requireWasteCorrectionInput({
        restaurantId,
        wasteEventId: "waste-1",
        note: "   "
      }),
    /correction note/
  );
  assert.throws(
    () =>
      requireWasteCorrectionInput({
        restaurantId,
        wasteEventId: "",
        note: "Mistake"
      }),
    /waste record/
  );
});

test("buildWasteCorrectionCandidate restores the exact waste quantity", () => {
  const candidate = buildWasteCorrectionCandidate({
    wasteEvent: wasteEvent(),
    restaurantId,
    note: "Logged against the wrong item",
    effectiveAt: "2026-08-03T17:00:00.000Z"
  });
  assert.equal(candidate.eventType, "correction");
  assert.equal(candidate.quantity, 500);
  assert.equal(candidate.supersedesEventId, "waste-1");
  assert.equal(candidate.source, "operator_correction");
  assert.equal(candidate.reasonCode, "waste_correction");
  assert.equal(candidate.sourceReference, "waste-1");
  assert.equal(candidate.metadata.note, "Logged against the wrong item");
  assert.throws(
    () =>
      buildWasteCorrectionCandidate({
        wasteEvent: wasteEvent({ eventType: "receipt" }),
        restaurantId,
        note: "Nope",
        effectiveAt: "2026-08-03T17:00:00.000Z"
      }),
    /Only waste/
  );
  assert.throws(
    () =>
      buildWasteCorrectionCandidate({
        wasteEvent: wasteEvent({ restaurantId: "restaurant-b" }),
        restaurantId,
        note: "Nope",
        effectiveAt: "2026-08-03T17:00:00.000Z"
      }),
    /cross-restaurant/
  );
});

test("findCorrectableWasteEvent fails closed once a correction already exists", () => {
  const waste = wasteEvent();
  const found = findCorrectableWasteEvent({
    restaurantId,
    wasteEventId: waste.id,
    events: [waste]
  });
  assert.equal(found.id, waste.id);

  assert.throws(
    () =>
      findCorrectableWasteEvent({
        restaurantId,
        wasteEventId: waste.id,
        events: [
          waste,
          wasteEvent({
            id: "correction-1",
            sequence: 3,
            eventType: "correction",
            quantity: 500,
            supersedesEventId: waste.id,
            clientEventId: "client-correction-1",
            idempotencyKey: "waste_correction:waste-1"
          })
        ]
      }),
    /already corrected/
  );
});

test("accepted waste correction restores projection and leaves analysis empty", () => {
  const count: InventoryEventInput = {
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "count",
    quantity: 2000,
    canonicalUnit: "g",
    effectiveAt: "2026-08-03T10:00:00.000Z",
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
      recordedAt: "2026-08-03T10:00:01.000Z"
    }
  });
  assert.equal(countAccepted.status, "accepted");
  if (countAccepted.status !== "accepted") throw new Error("expected count");

  const wasteInput: InventoryEventInput = {
    restaurantId,
    inventoryItemId: "tomatoes",
    eventType: "waste",
    quantity: 500,
    canonicalUnit: "g",
    effectiveAt: "2026-08-03T16:00:00.000Z",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: "waste-1",
    idempotencyKey: "inventory:waste-1",
    supersedesEventId: null,
    metadata: {}
  };
  const wasteAccepted = acceptInventoryEvent({
    existingEvents: [countAccepted.event],
    candidate: wasteInput,
    authority: {
      id: "event-waste",
      actorUserId: "manager-1",
      recordedAt: "2026-08-03T16:00:01.000Z"
    }
  });
  assert.equal(wasteAccepted.status, "accepted");
  if (wasteAccepted.status !== "accepted") throw new Error("expected waste");

  const afterWaste = projectInventoryEvents(restaurantId, "tomatoes", [
    countAccepted.event,
    wasteAccepted.event
  ]);
  assert.equal(afterWaste.quantity, 1500);

  const correctionCandidate = buildWasteCorrectionCandidate({
    wasteEvent: wasteAccepted.event,
    restaurantId,
    note: "Entered by mistake",
    effectiveAt: "2026-08-03T17:00:00.000Z"
  });
  const correctionAccepted = acceptInventoryEvent({
    existingEvents: [countAccepted.event, wasteAccepted.event],
    candidate: {
      ...correctionCandidate,
      clientEventId: "correction-1",
      idempotencyKey: "waste_correction:event-waste:correction-1"
    },
    authority: {
      id: "event-correction",
      actorUserId: "manager-1",
      recordedAt: "2026-08-03T17:00:01.000Z"
    }
  });
  assert.equal(correctionAccepted.status, "accepted");
  if (correctionAccepted.status !== "accepted") throw new Error("expected correction");

  const afterCorrection = projectInventoryEvents(restaurantId, "tomatoes", [
    countAccepted.event,
    wasteAccepted.event,
    correctionAccepted.event
  ]);
  assert.equal(afterCorrection.quantity, 2000);

  const analysis = buildWasteAnalysis({
    restaurantId,
    operatingDate: "2026-08-03",
    restaurantTimeZone: "America/New_York",
    inventoryItems: [item()],
    events: [wasteAccepted.event, correctionAccepted.event]
  });
  assert.equal(analysis.eventCount, 0);
  assert.equal(analysis.recentEvents.length, 0);

  const second = acceptInventoryEvent({
    existingEvents: [countAccepted.event, wasteAccepted.event, correctionAccepted.event],
    candidate: {
      ...correctionCandidate,
      clientEventId: "correction-2",
      idempotencyKey: "waste_correction:event-waste:correction-2"
    },
    authority: {
      id: "event-correction-2",
      actorUserId: "manager-1",
      recordedAt: "2026-08-03T17:05:00.000Z"
    }
  });
  assert.equal(second.status, "conflict");
});
