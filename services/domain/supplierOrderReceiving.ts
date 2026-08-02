import type {
  InventoryItem,
  InventoryMovement,
  PurchaseRecommendation,
  StorageLocation,
  SupplierOrder
} from "../../types/mise";
import { MAIN_STORAGE_LOCATION_NAME } from "./inventoryTransfer";

export const SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS = 240;
export const SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX = 1_000_000;
/** Cap completed-order receive ledger reads so one oversized delivery cannot blow the client. */
export const SUPPLIER_ORDER_RECEIVE_SUMMARY_LINE_MAX = 100;

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
  /** Shared default put-away station when a line does not override. */
  storageLocationId?: string | null;
  /** Optional per-line put-away stations; blank/missing falls back to storageLocationId. */
  storageLocationIdsByItemId?: Readonly<Record<string, string | null | undefined>>;
  parseNumber: (value: string) => number | null;
}): ReceiveFormLineBuildResult {
  const lines: SupplierOrderReceiveLineInput[] = [];
  const defaultStorageLocationId =
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

    const rawLineLocation = input.storageLocationIdsByItemId?.[inventoryItemId];
    const lineStorageLocationId =
      typeof rawLineLocation === "string" && rawLineLocation.trim()
        ? rawLineLocation.trim()
        : null;

    lines.push({
      inventoryItemId,
      quantityReceived,
      note,
      storageLocationId: lineStorageLocationId ?? defaultStorageLocationId
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

export type CompletedSupplierOrderReceiveLine = {
  inventoryItemId: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  discrepancy: number;
  hasDiscrepancy: boolean;
  note?: string;
  storageLocationName?: string;
  receivedAt: string;
};

export type CompletedSupplierOrderReceiveSummary = {
  orderId: string;
  lines: CompletedSupplierOrderReceiveLine[];
  discrepancyCount: number;
  shortShipCount: number;
  overReceiveCount: number;
  receivedAt: string | null;
};

type ReceiveMovementSnippet = Pick<
  InventoryMovement,
  "inventory_item_id" | "reason" | "created_at" | "metadata"
>;

/**
 * Builds a read-only ordered-vs-received summary for a completed supplier order
 * from append-only receiving ledger movements. Item names/units prefer the
 * linked recommendations, then inventory rows, then a safe fallback.
 */
export function buildCompletedSupplierOrderReceiveSummary(input: {
  orderId: string;
  movements: readonly ReceiveMovementSnippet[];
  recommendations?: readonly PurchaseRecommendation[];
  inventoryItems?: readonly InventoryItem[];
}): CompletedSupplierOrderReceiveSummary {
  const orderId = input.orderId.trim();
  const recommendationByItemId = new Map(
    (input.recommendations ?? [])
      .filter(
        (recommendation) =>
          recommendation.supplier_order_id === orderId && recommendation.status === "ordered"
      )
      .map((recommendation) => [recommendation.inventory_item_id, recommendation] as const)
  );
  const inventoryById = new Map((input.inventoryItems ?? []).map((item) => [item.id, item] as const));

  const linesByItem = new Map<string, CompletedSupplierOrderReceiveLine>();
  const sortedMovements = input.movements
    .slice()
    .sort((left, right) => left.created_at.localeCompare(right.created_at));

  for (const movement of sortedMovements) {
    if (movement.reason !== "receiving") continue;
    const metadata =
      movement.metadata && typeof movement.metadata === "object" ? movement.metadata : null;
    if (!metadata) continue;
    const movementOrderId =
      typeof metadata.supplier_order_id === "string" ? metadata.supplier_order_id.trim() : "";
    if (!orderId || movementOrderId !== orderId) continue;

    const quantityOrdered = finiteNonNegativeNumber(metadata.quantity_ordered);
    const quantityReceived = finiteNonNegativeNumber(metadata.quantity_received);
    if (
      quantityOrdered == null ||
      quantityReceived == null ||
      quantityOrdered <= 0 ||
      quantityReceived < 0 ||
      quantityReceived > SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX
    ) {
      continue;
    }

    const discrepancy =
      finiteNumber(metadata.discrepancy) ?? quantityReceived - quantityOrdered;
    const note =
      typeof metadata.note === "string" && metadata.note.trim()
        ? metadata.note.trim().slice(0, SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS)
        : undefined;
    const storageLocationName =
      typeof metadata.storage_location_name === "string" && metadata.storage_location_name.trim()
        ? metadata.storage_location_name.trim()
        : undefined;
    const recommendation = recommendationByItemId.get(movement.inventory_item_id);
    const inventoryItem = inventoryById.get(movement.inventory_item_id);
    const itemName =
      recommendation?.item_name?.trim() ||
      inventoryItem?.item_name?.trim() ||
      "Inventory item";
    const unit = recommendation?.unit?.trim() || inventoryItem?.unit?.trim() || "";
    const receivedAt =
      typeof movement.created_at === "string" && movement.created_at.trim()
        ? movement.created_at
        : "";
    if (!receivedAt) continue;

    // Latest movement for an item wins if a delivery was retried/idempotently replayed.
    linesByItem.set(movement.inventory_item_id, {
      inventoryItemId: movement.inventory_item_id,
      itemName,
      unit,
      quantityOrdered,
      quantityReceived,
      discrepancy,
      hasDiscrepancy: discrepancy !== 0,
      ...(note ? { note } : {}),
      ...(storageLocationName ? { storageLocationName } : {}),
      receivedAt
    });

    if (linesByItem.size >= SUPPLIER_ORDER_RECEIVE_SUMMARY_LINE_MAX) break;
  }

  const lines = Array.from(linesByItem.values()).sort((left, right) => {
    const byName = left.itemName.localeCompare(right.itemName);
    if (byName !== 0) return byName;
    return left.inventoryItemId.localeCompare(right.inventoryItemId);
  });

  return {
    orderId,
    lines,
    discrepancyCount: lines.filter((line) => line.hasDiscrepancy).length,
    shortShipCount: lines.filter((line) => line.discrepancy < 0).length,
    overReceiveCount: lines.filter((line) => line.discrepancy > 0).length,
    receivedAt: lines.reduce<string | null>((latest, line) => {
      if (!latest || line.receivedAt.localeCompare(latest) > 0) return line.receivedAt;
      return latest;
    }, null)
  };
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function finiteNonNegativeNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number != null && number >= 0 ? number : null;
}
