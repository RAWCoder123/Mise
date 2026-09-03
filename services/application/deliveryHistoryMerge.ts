import type { InventoryEvent } from "../domain/inventoryLedger";
import type { InventoryOutboxEntry } from "../domain/inventoryOutbox";
import { unitCostFromReceiptMetadata } from "../domain/adhocReceiptUnitCost";

export interface DeliveryHistoryEntry {
  id: string;
  clientEventId: string;
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  canonicalUnit: InventoryEvent["canonicalUnit"];
  effectiveAt: string;
  recordedAt: string | null;
  note: string | null;
  /** Optional display/purchase-unit cost captured with the ad-hoc receipt. */
  unitCost: number | null;
  /** True when the receipt is still pending outbox sync. */
  syncing: boolean;
}

function noteFromMetadata(metadata: Readonly<Record<string, unknown>> | undefined): string | null {
  if (!metadata) return null;
  const note = metadata.note;
  return typeof note === "string" && note.trim() ? note.trim() : null;
}

function sortByEffectiveAtDesc(left: DeliveryHistoryEntry, right: DeliveryHistoryEntry) {
  return (
    Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt) ||
    left.id.localeCompare(right.id)
  );
}

/** Pure merge of accepted ledger receipts and pending outbox receipts. */
export function mergeDeliveryHistoryEntries(input: {
  events: readonly InventoryEvent[];
  itemNames: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  queued: readonly InventoryOutboxEntry[];
}): DeliveryHistoryEntry[] {
  const itemNameById =
    input.itemNames instanceof Map
      ? input.itemNames
      : new Map(Object.entries(input.itemNames));

  const accepted: DeliveryHistoryEntry[] = input.events
    .filter((event) => event.eventType === "receipt")
    .map((event) => ({
      id: event.id,
      clientEventId: event.clientEventId,
      inventoryItemId: event.inventoryItemId,
      itemName: itemNameById.get(event.inventoryItemId) ?? event.inventoryItemId,
      quantity: event.quantity,
      canonicalUnit: event.canonicalUnit,
      effectiveAt: event.effectiveAt,
      recordedAt: event.recordedAt,
      note: noteFromMetadata(event.metadata),
      unitCost: unitCostFromReceiptMetadata(event.metadata),
      syncing: false
    }));

  const acceptedClientIds = new Set(accepted.map((entry) => entry.clientEventId));

  const pending: DeliveryHistoryEntry[] = input.queued
    .filter(
      (entry) =>
        entry.event.eventType === "receipt" &&
        (entry.status === "pending" || entry.status === "submitting") &&
        !acceptedClientIds.has(entry.event.clientEventId)
    )
    .map((entry) => ({
      id: entry.id,
      clientEventId: entry.event.clientEventId,
      inventoryItemId: entry.event.inventoryItemId,
      itemName: itemNameById.get(entry.event.inventoryItemId) ?? entry.event.inventoryItemId,
      quantity: entry.event.quantity,
      canonicalUnit: entry.event.canonicalUnit,
      effectiveAt: entry.event.effectiveAt,
      recordedAt: null,
      note: noteFromMetadata(entry.event.metadata),
      unitCost: unitCostFromReceiptMetadata(entry.event.metadata),
      syncing: true
    }));

  return [...pending, ...accepted].sort(sortByEffectiveAtDesc);
}
