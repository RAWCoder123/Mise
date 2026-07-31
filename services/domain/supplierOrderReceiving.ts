import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";

export const SUPPLIER_ORDER_RECEIVE_NOTE_MAX_CHARACTERS = 240;
export const SUPPLIER_ORDER_RECEIVE_QUANTITY_MAX = 1_000_000;

export type SupplierOrderReceiveLineInput = {
  inventoryItemId: string;
  quantityReceived: number;
  note?: string | null;
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
  recommendations: readonly PurchaseRecommendation[]
): SupplierOrderReceiveLineInput[] {
  return recommendations.map((recommendation) => ({
    inventoryItemId: recommendation.inventory_item_id,
    quantityReceived: recommendation.recommended_quantity,
    note: null
  }));
}

export function planSupplierOrderReceive(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  receiveLines: readonly SupplierOrderReceiveLineInput[];
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
      ...(note ? { note } : {}),
      reason: "receiving",
      sourceWorkflow: "receive_supplier_order",
      metadata: {
        supplier_order_id: input.order.id,
        recommendation_id: recommendation.id,
        quantity_ordered: quantityOrdered,
        quantity_received: quantityReceived,
        discrepancy,
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
