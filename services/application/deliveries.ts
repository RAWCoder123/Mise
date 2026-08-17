import { fetchQueuedInventoryEvents } from "./deviceInventoryOutbox";
import {
  mergeDeliveryHistoryEntries,
  type DeliveryHistoryEntry
} from "./deliveryHistoryMerge";
import {
  applyDeliveryLineAdjustments,
  buildDeliveryLinesFromOrderRecommendations,
  buildSupplierDeliveryReceivePreview,
  deliveryClientIdForOrder,
  type SupplierDeliveryLineAdjustment,
  type SupplierDeliveryReceivePreview
} from "../domain/supplierDelivery";
import { getMiseRepository } from "./repository";

export type { DeliveryHistoryEntry } from "./deliveryHistoryMerge";
export { mergeDeliveryHistoryEntries } from "./deliveryHistoryMerge";
export type {
  SupplierDeliveryLineAdjustment,
  SupplierDeliveryReceivePreview,
  SupplierDeliveryReceivePreviewLine
} from "../domain/supplierDelivery";

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
 * Builds the receive checklist for a sent supplier order so operators can
 * confirm as-ordered or record short-ships, damage, and reasons before submit.
 */
export async function previewSupplierOrderDelivery(
  restaurantId: string,
  supplierOrderId: string
): Promise<SupplierDeliveryReceivePreview> {
  const { order, recommendations, inventoryItems } = await loadReceivableOrderContext(
    restaurantId,
    supplierOrderId
  );
  return buildSupplierDeliveryReceivePreview({
    order,
    recommendations,
    inventoryItems
  });
}

/**
 * Operator receive path: records a supplier delivery, projects inventory
 * receipts, and measures the related Mise action outcome when present.
 * Optional line adjustments let the operator record discrepancies instead of
 * silently accepting every line as ordered.
 */
export async function receiveSupplierOrderDelivery(
  restaurantId: string,
  supplierOrderId: string,
  options: {
    notes?: string | null;
    receivedAt?: string;
    clientDeliveryId?: string;
    lineAdjustments?: readonly SupplierDeliveryLineAdjustment[];
  } = {}
) {
  const { order, recommendations, inventoryItems } = await loadReceivableOrderContext(
    restaurantId,
    supplierOrderId
  );
  const normalizedRestaurantId = order.restaurant_id;
  const normalizedOrderId = order.id;

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

  const lines = applyDeliveryLineAdjustments(built.lines, options.lineAdjustments ?? []);

  const receivedAt = options.receivedAt ?? new Date().toISOString();
  const clientDeliveryId =
    options.clientDeliveryId?.trim() || deliveryClientIdForOrder(normalizedOrderId, receivedAt);

  const repository = getMiseRepository();
  return repository.recordSupplierOrderDelivery(normalizedRestaurantId, {
    supplierOrderId: normalizedOrderId,
    clientDeliveryId,
    receivedAt,
    lines,
    notes: options.notes ?? null
  });
}

async function loadReceivableOrderContext(restaurantId: string, supplierOrderId: string) {
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

  return { order, recommendations, inventoryItems };
}
