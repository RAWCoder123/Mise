import type { InventoryItem, PurchaseRecommendation, StorageLocation, SupplierOrder } from "../../types/mise";
import { MAIN_STORAGE_LOCATION_NAME } from "./inventoryTransfer";

export const SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS = 240;
export const SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX = 1_000_000;

export type SupplierOrderReceiveLineInput = {
  inventoryItemId: string;
  quantityReceived: number;
  note?: string | null;
  /** Optional put-away station. Omitted/null resolves to Main when locations are supplied. */
  storageLocationId?: string | null;
};

export type PlannedSupplierOrderReceiveLine = {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  quantityBefore: number;
  quantityOrdered: number;
  quantityReceived: number;
  quantityAfter: number;
  discrepancy: number;
  hasDiscrepancy: boolean;
  storageLocationId?: string;
  storageLocationName?: string;
  note?: string;
  reason: "receiving";
  sourceWorkflow: "receive_supplier_order";
  metadata: {
    supplier_order_id: string;
    recommendation_id: string;
    quantity_ordered: number;
    quantity_received: number;
    discrepancy: number;
    note?: string;
    storage_location_id?: string;
    storage_location_name?: string;
  };
};

export type PlannedSupplierOrderReceive = {
  orderId: string;
  supplierName: string;
  lines: PlannedSupplierOrderReceiveLine[];
  discrepancyCount: number;
  reason: "receiving";
  sourceWorkflow: "receive_supplier_order";
};

export function linkedOrderedRecommendationsForOrder(
  orderId: string,
  recommendations: readonly PurchaseRecommendation[]
): PurchaseRecommendation[] {
  return recommendations
    .filter(
      (recommendation) =>
        recommendation.supplier_order_id === orderId && recommendation.status === "ordered"
    )
    .slice()
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function defaultReceiveLinesFromRecommendations(
  recommendations: readonly PurchaseRecommendation[],
  storageLocationId?: string | null
): SupplierOrderReceiveLineInput[] {
  const resolvedStorageLocationId =
    typeof storageLocationId === "string" && storageLocationId.trim()
      ? storageLocationId.trim()
      : null;
  return recommendations.map((recommendation) => ({
    inventoryItemId: recommendation.inventory_item_id,
    quantityReceived: recommendation.recommended_quantity,
    note: null,
    storageLocationId: resolvedStorageLocationId
  }));
}

export function resolveReceiveStorageLocation(
  storageLocations: readonly StorageLocation[],
  storageLocationId?: string | null
): StorageLocation {
  const active = storageLocations.filter((location) => location.is_active);
  const main = active.find(
    (location) => location.name.toLowerCase() === MAIN_STORAGE_LOCATION_NAME.toLowerCase()
  );
  const requested = typeof storageLocationId === "string" ? storageLocationId.trim() : "";
  if (!requested) {
    if (!main) {
      throw new Error(`"${MAIN_STORAGE_LOCATION_NAME}" storage location is required.`);
    }
    return main;
  }
  const match = active.find((location) => location.id === requested);
  if (!match) {
    throw new Error("Storage location not found.");
  }
  return match;
}

export type ReceiveFormLineBuildResult =
  | { ok: true; lines: SupplierOrderReceiveLineInput[] }
  | { ok: false; error: "invalid_quantity" | "note_too_long" };

export function isReceiveQuantityInputReady(
  raw: string,
  parseNumber: (value: string) => number | null
): boolean {
  const parsed = parseNumber(raw.trim());
  return (
    parsed != null &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX
  );
}

export function normalizeReceiveNoteInput(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const note = raw.trim();
  return note ? note : null;
}

/**
 * Builds validated receive payloads from locale-aware quantity strings and optional line notes.
 * Keeps Number() out of the UI path so Spanish/Chinese decimal input stays trustworthy.
 */
export function buildReceiveLinesFromFormInputs(input: {
  inventoryItemIds: readonly string[];
  quantitiesByItemId: Readonly<Record<string, string>>;
  notesByItemId?: Readonly<Record<string, string>>;
  storageLocationId?: string | null;
  parseNumber: (value: string) => number | null;
}): ReceiveFormLineBuildResult {
  const lines: SupplierOrderReceiveLineInput[] = [];
  const storageLocationId =
    typeof input.storageLocationId === "string" && input.storageLocationId.trim()
      ? input.storageLocationId.trim()
      : null;

  for (const inventoryItemId of input.inventoryItemIds) {
    const rawQuantity = input.quantitiesByItemId[inventoryItemId] ?? "";
    const quantityReceived = input.parseNumber(rawQuantity.trim());
    if (
      quantityReceived == null ||
      !Number.isFinite(quantityReceived) ||
      quantityReceived < 0 ||
      quantityReceived > SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX
    ) {
      return { ok: false, error: "invalid_quantity" };
    }

    const note = normalizeReceiveNoteInput(input.notesByItemId?.[inventoryItemId]);
    if (note && note.length > SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS) {
      return { ok: false, error: "note_too_long" };
    }

    lines.push({
      inventoryItemId,
      quantityReceived,
      note,
      storageLocationId
    });
  }

  return { ok: true, lines };
}

export function planSupplierOrderReceive(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  receiveLines: readonly SupplierOrderReceiveLineInput[];
  storageLocations?: readonly StorageLocation[];
}): PlannedSupplierOrderReceive {
  if (input.order.status !== "sent") {
    throw new Error("Only sent supplier orders can be received.");
  }

  const linked = linkedOrderedRecommendationsForOrder(input.order.id, input.recommendations);
  if (linked.length === 0) {
    throw new Error("This order has no ordered recommendation lines to receive.");
  }

  const inventoryById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const receiveByItemId = new Map<string, SupplierOrderReceiveLineInput>();
  for (const line of input.receiveLines) {
    if (receiveByItemId.has(line.inventoryItemId)) {
      throw new Error("Each inventory item can appear only once in a receive payload.");
    }
    receiveByItemId.set(line.inventoryItemId, line);
  }

  if (receiveByItemId.size !== linked.length) {
    throw new Error("Receive every ordered line before completing the delivery.");
  }

  for (const recommendation of linked) {
    if (!receiveByItemId.has(recommendation.inventory_item_id)) {
      throw new Error(`Missing received quantity for ${recommendation.item_name}.`);
    }
  }

  const storageLocations = input.storageLocations ?? null;

  const lines: PlannedSupplierOrderReceiveLine[] = [];
  for (const recommendation of linked) {
    const receiveLine = receiveByItemId.get(recommendation.inventory_item_id)!;
    const inventoryItem = inventoryById.get(recommendation.inventory_item_id);
    if (!inventoryItem || inventoryItem.restaurant_id !== input.order.restaurant_id) {
      throw new Error(`Inventory item missing for ${recommendation.item_name}.`);
    }

    const quantityBefore = Number(inventoryItem.current_quantity);
    const quantityOrdered = Number(recommendation.recommended_quantity);
    const quantityReceived = Number(receiveLine.quantityReceived);
    if (!Number.isFinite(quantityBefore) || quantityBefore < 0) {
      throw new Error("Inventory on-hand quantity is invalid.");
    }
    if (!Number.isFinite(quantityOrdered) || quantityOrdered <= 0) {
      throw new Error("Ordered quantity is invalid.");
    }
    if (!Number.isFinite(quantityReceived) || quantityReceived < 0) {
      throw new Error("Received quantity must be zero or greater.");
    }
    if (quantityReceived > SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX) {
      throw new Error("Received quantity is outside supported limits.");
    }

    const note =
      typeof receiveLine.note === "string" && receiveLine.note.trim()
        ? receiveLine.note.trim()
        : undefined;
    if (note && note.length > SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS) {
      throw new Error("Receive note is outside supported limits.");
    }

    const putAway = storageLocations
      ? resolveReceiveStorageLocation(storageLocations, receiveLine.storageLocationId)
      : null;

    const quantityAfter = quantityBefore + quantityReceived;
    const discrepancy = quantityReceived - quantityOrdered;
    lines.push({
      inventoryItemId: recommendation.inventory_item_id,
      itemName: recommendation.item_name,
      unit: recommendation.unit,
      quantityBefore,
      quantityOrdered,
      quantityReceived,
      quantityAfter,
      discrepancy,
      hasDiscrepancy: discrepancy !== 0,
      ...(putAway
        ? { storageLocationId: putAway.id, storageLocationName: putAway.name }
        : {}),
      ...(note ? { note } : {}),
      reason: "receiving",
      sourceWorkflow: "receive_supplier_order",
      metadata: {
        supplier_order_id: input.order.id,
        recommendation_id: recommendation.id,
        quantity_ordered: quantityOrdered,
        quantity_received: quantityReceived,
        discrepancy,
        ...(putAway
          ? {
              storage_location_id: putAway.id,
              storage_location_name: putAway.name
            }
          : {}),
        ...(note ? { note } : {})
      }
    });
  }

  return {
    orderId: input.order.id,
    supplierName: input.order.supplier_name,
    lines,
    discrepancyCount: lines.filter((line) => line.hasDiscrepancy).length,
    reason: "receiving",
    sourceWorkflow: "receive_supplier_order"
  };
}

export function applyPlannedReceiveToInventory(
  inventoryItems: readonly InventoryItem[],
  planned: PlannedSupplierOrderReceive,
  receivedAt: string
): InventoryItem[] {
  const quantityByItemId = new Map(
    planned.lines.map((line) => [line.inventoryItemId, line.quantityAfter] as const)
  );
  return inventoryItems.map((item) =>
    quantityByItemId.has(item.id)
      ? {
          ...item,
          current_quantity: quantityByItemId.get(item.id) as number,
          last_updated: receivedAt
        }
      : item
  );
}
