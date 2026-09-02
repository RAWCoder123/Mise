import type { InventoryEvent, InventoryEventInput } from "./inventoryLedger";

export const OPERATOR_RECEIPT_SOURCE = "operator_receipt";

export type ReceiptCorrectionCandidate = Omit<
  InventoryEventInput,
  "clientEventId" | "idempotencyKey"
>;

/**
 * Builds a ledger correction that reverses an operator Log Delivery receipt.
 * Corrections are signed deltas; receipts added stock, so the reversing delta
 * is negative and equal in magnitude to the superseded receipt quantity.
 *
 * Supplier-order receives (`source: supplier_delivery`) are intentionally
 * excluded — those use the dedicated order receive / discrepancy flows.
 */
export function buildReceiptCorrectionCandidate(input: {
  receiptEvent: InventoryEvent;
  restaurantId: string;
  note: string;
  effectiveAt: string;
}): ReceiptCorrectionCandidate {
  const restaurantId = input.restaurantId.trim();
  const note = input.note.trim();
  if (!restaurantId) throw new Error("Receipt correction requires a restaurant.");
  if (!note) throw new Error("Enter a correction note.");
  if (note.length > 500) throw new Error("Enter a shorter correction note.");
  if (!Number.isFinite(Date.parse(input.effectiveAt))) {
    throw new Error("Enter a valid correction time.");
  }

  const receipt = input.receiptEvent;
  if (receipt.restaurantId !== restaurantId) {
    throw new Error("Receipt correction received cross-restaurant evidence.");
  }
  if (receipt.eventType !== "receipt") {
    throw new Error("Only receipt records can be corrected here.");
  }
  if (receipt.source !== OPERATOR_RECEIPT_SOURCE) {
    throw new Error("Only manual Log Delivery receipts can be corrected here.");
  }
  if (!Number.isFinite(receipt.quantity) || receipt.quantity <= 0) {
    throw new Error("Receipt quantity is not correctable.");
  }
  if (
    receipt.canonicalUnit !== "g" &&
    receipt.canonicalUnit !== "ml" &&
    receipt.canonicalUnit !== "each"
  ) {
    throw new Error("Receipt unit is not correctable.");
  }

  return {
    restaurantId,
    inventoryItemId: receipt.inventoryItemId,
    eventType: "correction",
    quantity: -receipt.quantity,
    canonicalUnit: receipt.canonicalUnit,
    effectiveAt: new Date(input.effectiveAt).toISOString(),
    source: "operator_correction",
    sourceReference: receipt.id,
    reasonCode: "receipt_correction",
    supersedesEventId: receipt.id,
    metadata: {
      note: note.slice(0, 500),
      corrected_event_type: "receipt",
      corrected_source: OPERATOR_RECEIPT_SOURCE
    }
  };
}

/**
 * Locates a still-correctable operator receipt inside tenant-scoped evidence.
 * Fails closed once a correction already supersedes the receipt, when the
 * event is missing, or when the source is not a manual operator receipt.
 */
export function findCorrectableReceiptEvent(input: {
  restaurantId: string;
  receiptEventId: string;
  events: readonly InventoryEvent[];
}): InventoryEvent {
  const restaurantId = input.restaurantId.trim();
  const receiptEventId = input.receiptEventId.trim();
  if (!restaurantId) throw new Error("Receipt correction requires a restaurant.");
  if (!receiptEventId) throw new Error("Choose a receipt record to correct.");
  if (input.events.some((event) => event.restaurantId !== restaurantId)) {
    throw new Error("Receipt correction received cross-restaurant evidence.");
  }

  const receipt = input.events.find((event) => event.id === receiptEventId);
  if (!receipt || receipt.eventType !== "receipt") {
    throw new Error("Receipt record was not found.");
  }
  if (receipt.source !== OPERATOR_RECEIPT_SOURCE) {
    throw new Error("Only manual Log Delivery receipts can be corrected here.");
  }
  if (
    input.events.some(
      (event) =>
        event.eventType === "correction" && event.supersedesEventId === receiptEventId
    )
  ) {
    throw new Error("That receipt record was already corrected.");
  }
  return receipt;
}

/**
 * Pure filter of operator receipts that still lack a superseding correction.
 */
export function listCorrectableOperatorReceipts(
  events: readonly InventoryEvent[]
): InventoryEvent[] {
  const superseded = new Set(
    events
      .filter((event) => event.eventType === "correction" && event.supersedesEventId)
      .map((event) => event.supersedesEventId!)
  );

  return events
    .filter(
      (event) =>
        event.eventType === "receipt" &&
        event.source === OPERATOR_RECEIPT_SOURCE &&
        event.quantity > 0 &&
        !superseded.has(event.id)
    )
    .sort(
      (left, right) =>
        Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt) ||
        right.sequence - left.sequence ||
        left.id.localeCompare(right.id)
    );
}
