import type { InventoryEvent, InventoryEventType } from "../domain/inventoryLedger";

export type InventoryLedgerQuantityKind = "set" | "stockout" | "delta";

/** How the operator-facing quantity line should read for a ledger event type. */
export function inventoryLedgerQuantityKind(
  eventType: InventoryEventType
): InventoryLedgerQuantityKind {
  if (eventType === "count") return "set";
  if (eventType === "stockout") return "stockout";
  return "delta";
}

/**
 * Signed quantity for delta-style rows. Waste and usage are stored as positive
 * depletion magnitudes; presentation shows them as negative movements.
 */
export function inventoryLedgerSignedQuantity(
  event: Pick<InventoryEvent, "eventType" | "quantity">
): number {
  if (event.eventType === "waste" || event.eventType === "usage") {
    return -Math.abs(event.quantity);
  }
  if (event.eventType === "stockout") return 0;
  return event.quantity;
}

export function inventoryLedgerEventMessageKey(
  eventType: InventoryEventType
): `inventory.ops.event.${InventoryEventType}` {
  return `inventory.ops.event.${eventType}`;
}
