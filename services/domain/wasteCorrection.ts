import type { InventoryEvent, InventoryEventInput } from "./inventoryLedger";

export type WasteCorrectionCandidate = Omit<
  InventoryEventInput,
  "clientEventId" | "idempotencyKey"
>;

/**
 * Builds a ledger correction that restores on-hand by the exact waste quantity.
 * Corrections are signed deltas; waste subtracted, so the restoring delta is
 * positive and equal to the superseded waste quantity.
 */
export function buildWasteCorrectionCandidate(input: {
  wasteEvent: InventoryEvent;
  restaurantId: string;
  note: string;
  effectiveAt: string;
}): WasteCorrectionCandidate {
  const restaurantId = input.restaurantId.trim();
  const note = input.note.trim();
  if (!restaurantId) throw new Error("Waste correction requires a restaurant.");
  if (!note) throw new Error("Enter a correction note.");
  if (note.length > 500) throw new Error("Enter a shorter correction note.");
  if (!Number.isFinite(Date.parse(input.effectiveAt))) {
    throw new Error("Enter a valid correction time.");
  }

  const waste = input.wasteEvent;
  if (waste.restaurantId !== restaurantId) {
    throw new Error("Waste correction received cross-restaurant evidence.");
  }
  if (waste.eventType !== "waste") {
    throw new Error("Only waste records can be corrected here.");
  }
  if (!Number.isFinite(waste.quantity) || waste.quantity <= 0) {
    throw new Error("Waste quantity is not correctable.");
  }
  if (waste.canonicalUnit !== "g" && waste.canonicalUnit !== "ml" && waste.canonicalUnit !== "each") {
    throw new Error("Waste unit is not correctable.");
  }

  return {
    restaurantId,
    inventoryItemId: waste.inventoryItemId,
    eventType: "correction",
    quantity: waste.quantity,
    canonicalUnit: waste.canonicalUnit,
    effectiveAt: new Date(input.effectiveAt).toISOString(),
    source: "operator_correction",
    sourceReference: waste.id,
    reasonCode: "waste_correction",
    supersedesEventId: waste.id,
    metadata: {
      note: note.slice(0, 500),
      corrected_event_type: "waste"
    }
  };
}

export function findCorrectableWasteEvent(input: {
  restaurantId: string;
  wasteEventId: string;
  events: readonly InventoryEvent[];
}): InventoryEvent {
  const restaurantId = input.restaurantId.trim();
  const wasteEventId = input.wasteEventId.trim();
  if (!restaurantId) throw new Error("Waste correction requires a restaurant.");
  if (!wasteEventId) throw new Error("Choose a waste record to correct.");
  if (input.events.some((event) => event.restaurantId !== restaurantId)) {
    throw new Error("Waste correction received cross-restaurant evidence.");
  }

  const waste = input.events.find((event) => event.id === wasteEventId);
  if (!waste || waste.eventType !== "waste") {
    throw new Error("Waste record was not found.");
  }
  if (
    input.events.some(
      (event) =>
        event.eventType === "correction" && event.supersedesEventId === wasteEventId
    )
  ) {
    throw new Error("That waste record was already corrected.");
  }
  return waste;
}
