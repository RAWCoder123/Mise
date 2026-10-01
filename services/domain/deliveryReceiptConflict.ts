import type { InventoryEvent } from "./inventoryLedger";
import type { InventoryOutboxEntry } from "./inventoryOutbox";
import type { PurchaseRecommendation, SupplierOrder } from "../../types/mise";

/** Operator ad-hoc Log Delivery receipts (device outbox → inventory ledger). */
export const MANUAL_RECEIPT_SOURCE = "operator_receipt";

/** Receipts projected by supplier-order Mark received / record_supplier_delivery. */
export const SUPPLIER_DELIVERY_RECEIPT_SOURCE = "supplier_delivery";

export interface OpenSentOrderReceiptConflict {
  orderId: string;
  supplierName: string;
  inventoryItemId: string;
  recommendationId: string;
}

export interface ManualReceiptBeforeOrderReceiveConflict {
  inventoryItemId: string;
  eventId: string;
  quantity: number;
  effectiveAt: string;
  source: string;
  syncing: boolean;
}

function isLinkedOrderRecommendation(
  recommendation: PurchaseRecommendation,
  order: SupplierOrder
): boolean {
  return (
    recommendation.restaurant_id === order.restaurant_id &&
    recommendation.supplier_order_id === order.id &&
    (recommendation.status === "ordered" || recommendation.status === "approved")
  );
}

/**
 * Sent supplier orders that already include this inventory item. Logging an
 * ad-hoc receipt for the same item risks double-counting when the operator
 * later marks the order received.
 */
export function findOpenSentOrderConflictsForInventoryItem(input: {
  restaurantId: string;
  inventoryItemId: string;
  orders: readonly SupplierOrder[];
  recommendations: readonly PurchaseRecommendation[];
}): OpenSentOrderReceiptConflict[] {
  const restaurantId = input.restaurantId.trim();
  const inventoryItemId = input.inventoryItemId.trim();
  if (!restaurantId || !inventoryItemId) return [];

  const sentOrders = input.orders.filter(
    (order) => order.restaurant_id === restaurantId && order.status === "sent"
  );
  if (sentOrders.length === 0) return [];

  const conflicts: OpenSentOrderReceiptConflict[] = [];
  const seenOrderIds = new Set<string>();

  for (const order of sentOrders) {
    for (const recommendation of input.recommendations) {
      if (!isLinkedOrderRecommendation(recommendation, order)) continue;
      if (recommendation.inventory_item_id !== inventoryItemId) continue;
      if (seenOrderIds.has(order.id)) continue;
      seenOrderIds.add(order.id);
      conflicts.push({
        orderId: order.id,
        supplierName: order.supplier_name,
        inventoryItemId,
        recommendationId: recommendation.id
      });
    }
  }

  return conflicts.sort((left, right) => left.orderId.localeCompare(right.orderId));
}

function isManualReceiptSource(source: string | null | undefined): boolean {
  return (source ?? "").trim() === MANUAL_RECEIPT_SOURCE;
}

/**
 * Operator ad-hoc receipts (accepted or still syncing) for items linked to a
 * sent supplier order. Marking that order received would apply as-ordered
 * quantities again and inflate on-hand stock.
 */
export function findManualReceiptConflictsForOrderReceive(input: {
  restaurantId: string;
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  events: readonly InventoryEvent[];
  queued?: readonly InventoryOutboxEntry[];
}): ManualReceiptBeforeOrderReceiveConflict[] {
  const restaurantId = input.restaurantId.trim();
  if (!restaurantId) return [];
  if (input.order.restaurant_id !== restaurantId) return [];
  if (input.order.status !== "sent") return [];

  const linkedItemIds = new Set(
    input.recommendations
      .filter((recommendation) => isLinkedOrderRecommendation(recommendation, input.order))
      .map((recommendation) => recommendation.inventory_item_id)
  );
  if (linkedItemIds.size === 0) return [];

  const conflicts: ManualReceiptBeforeOrderReceiveConflict[] = [];

  for (const event of input.events) {
    if (event.restaurantId !== restaurantId) continue;
    if (event.eventType !== "receipt") continue;
    if (!isManualReceiptSource(event.source)) continue;
    if (!linkedItemIds.has(event.inventoryItemId)) continue;
    conflicts.push({
      inventoryItemId: event.inventoryItemId,
      eventId: event.id,
      quantity: event.quantity,
      effectiveAt: event.effectiveAt,
      source: event.source,
      syncing: false
    });
  }

  for (const entry of input.queued ?? []) {
    if (entry.event.restaurantId !== restaurantId) continue;
    if (entry.event.eventType !== "receipt") continue;
    if (!isManualReceiptSource(entry.event.source)) continue;
    if (!linkedItemIds.has(entry.event.inventoryItemId)) continue;
    if (entry.status !== "pending" && entry.status !== "submitting") continue;
    conflicts.push({
      inventoryItemId: entry.event.inventoryItemId,
      eventId: entry.id,
      quantity: entry.event.quantity,
      effectiveAt: entry.event.effectiveAt,
      source: entry.event.source,
      syncing: true
    });
  }

  return conflicts.sort(
    (left, right) =>
      Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt) ||
      left.eventId.localeCompare(right.eventId)
  );
}
