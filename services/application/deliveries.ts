import { fetchQueuedInventoryEvents } from "./deviceInventoryOutbox";
import {
  mergeDeliveryHistoryEntries,
  type DeliveryHistoryEntry
} from "./deliveryHistoryMerge";
import {
  findManualReceiptConflictsForOrderReceive,
  findOpenSentOrderConflictsForInventoryItem,
  type ManualReceiptBeforeOrderReceiveConflict,
  type OpenSentOrderReceiptConflict
} from "../domain/deliveryReceiptConflict";
import {
  buildDeliveryLinesFromOrderRecommendations,
  deliveryClientIdForOrder
} from "../domain/supplierDelivery";
import { getMiseRepository } from "./repository";

export type { DeliveryHistoryEntry } from "./deliveryHistoryMerge";
export { mergeDeliveryHistoryEntries } from "./deliveryHistoryMerge";
export type {
  ManualReceiptBeforeOrderReceiveConflict,
  OpenSentOrderReceiptConflict
} from "../domain/deliveryReceiptConflict";

/**
 * Receipt history for the delivery log screen: accepted ledger receipts plus
 * pending outbox receipts still syncing on this device.
 */
export async function fetchDeliveryHistory(restaurantId: string): Promise<DeliveryHistoryEntry[]> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const repository = getMiseRepository();
  const [events, items, queued] = await Promise.all([
    repository.listInventoryEvents(normalizedRestaurantId, {
      eventTypes: ["receipt"],
      limit: 100
    }),
    repository.fetchInventoryItems(normalizedRestaurantId),
    fetchQueuedInventoryEvents(normalizedRestaurantId)
  ]);

  return mergeDeliveryHistoryEntries({
    events,
    itemNames: new Map(items.map((item) => [item.id, item.item_name])),
    queued
  });
}

/**
 * Sent supplier orders that already list this inventory item. Used by Log
 * Delivery to warn before an ad-hoc receipt that could double-count stock.
 */
export async function fetchOpenSentOrderConflictsForInventoryItem(
  restaurantId: string,
  inventoryItemId: string
): Promise<OpenSentOrderReceiptConflict[]> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedItemId = inventoryItemId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedItemId) throw new Error("Missing inventory item.");

  const repository = getMiseRepository();
  const [orders, recommendations] = await Promise.all([
    repository.fetchSupplierOrders(normalizedRestaurantId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all")
  ]);

  return findOpenSentOrderConflictsForInventoryItem({
    restaurantId: normalizedRestaurantId,
    inventoryItemId: normalizedItemId,
    orders,
    recommendations
  });
}

/**
 * Operator ad-hoc receipts already applied (or still syncing) for items on a
 * sent supplier order. Mark received would add ordered quantities again.
 */
export async function fetchManualReceiptConflictsForSupplierOrder(
  restaurantId: string,
  supplierOrderId: string
): Promise<ManualReceiptBeforeOrderReceiveConflict[]> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = supplierOrderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");

  const repository = getMiseRepository();
  const [order, recommendations, events, queued] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.listInventoryEvents(normalizedRestaurantId, {
      eventTypes: ["receipt"],
      limit: 200
    }),
    fetchQueuedInventoryEvents(normalizedRestaurantId)
  ]);

  if (!order || order.restaurant_id !== normalizedRestaurantId) {
    throw new Error("Supplier order not found.");
  }

  return findManualReceiptConflictsForOrderReceive({
    restaurantId: normalizedRestaurantId,
    order,
    recommendations,
    events,
    queued
  });
}

/**
 * Operator receive path: records a supplier delivery, projects inventory
 * receipts, and measures the related Mise action outcome when present.
 */
export async function receiveSupplierOrderDelivery(
  restaurantId: string,
  supplierOrderId: string,
  options: { notes?: string | null; receivedAt?: string; clientDeliveryId?: string } = {}
) {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = supplierOrderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");

  const repository = getMiseRepository();
  const [order, recommendations, inventoryItems] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.fetchInventoryItems(normalizedRestaurantId)
  ]);

  if (!order || order.restaurant_id !== normalizedRestaurantId) {
    throw new Error("Supplier order not found.");
  }
  if (order.status !== "sent" && order.status !== "completed") {
    throw new Error("Only sent orders can be received.");
  }

  let built = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations,
    inventoryItems,
    requireVerifiedCanonicalUnit: true
  });
  if (built.lines.length === 0) {
    // Demo / incomplete unit setup: still allow as-ordered receive when items exist.
    built = buildDeliveryLinesFromOrderRecommendations({
      order,
      recommendations,
      inventoryItems,
      requireVerifiedCanonicalUnit: false
    });
  }
  if (built.lines.length === 0) {
    throw new Error("No receivable lines are ready for this supplier order.");
  }

  const receivedAt = options.receivedAt ?? new Date().toISOString();
  const clientDeliveryId =
    options.clientDeliveryId?.trim() || deliveryClientIdForOrder(normalizedOrderId, receivedAt);

  return repository.recordSupplierOrderDelivery(normalizedRestaurantId, {
    supplierOrderId: normalizedOrderId,
    clientDeliveryId,
    receivedAt,
    lines: built.lines,
    notes: options.notes ?? null
  });
}
