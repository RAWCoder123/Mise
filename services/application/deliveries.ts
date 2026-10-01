import { fetchQueuedInventoryEvents } from "./deviceInventoryOutbox";
import {
  mergeDeliveryHistoryEntries,
  type DeliveryHistoryEntry
} from "./deliveryHistoryMerge";
import {
  buildDeliveryLinesFromOrderRecommendations,
  deliveryClientIdForOrder
} from "../domain/supplierDelivery";
import {
  canCloseSupplierOrderUndelivered,
  requireUndeliveredCloseReason,
  type UndeliveredCloseReason
} from "../domain/supplierOrderUndeliveredClose";
import type { CloseSupplierOrderUndeliveredResult } from "../repositories/repositoryContracts";
import { getMiseRepository } from "./repository";

export type { DeliveryHistoryEntry } from "./deliveryHistoryMerge";
export { mergeDeliveryHistoryEntries } from "./deliveryHistoryMerge";

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

/**
 * Completes a still-sent supplier order that never produced delivery evidence,
 * without writing an inventory receipt. Requires a bounded operator reason.
 */
export async function closeSupplierOrderUndelivered(
  restaurantId: string,
  supplierOrderId: string,
  reason: UndeliveredCloseReason | string
): Promise<CloseSupplierOrderUndeliveredResult> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = supplierOrderId.trim();
  const normalizedReason = requireUndeliveredCloseReason(reason);
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");

  const repository = getMiseRepository();
  const [order, history] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchSupplierDeliveryHistory(normalizedRestaurantId)
  ]);

  if (!order || order.restaurant_id !== normalizedRestaurantId) {
    throw new Error("Supplier order not found.");
  }

  const priorDeliveryCount = history.deliveries.filter(
    (delivery) =>
      delivery.restaurant_id === normalizedRestaurantId &&
      delivery.supplier_order_id === normalizedOrderId
  ).length;

  if (order.status === "completed") {
    return {
      outcome: "already_completed",
      orderId: order.id,
      supplierId: order.supplier_id,
      priorDeliveryCount,
      reason: normalizedReason
    };
  }

  if (
    !canCloseSupplierOrderUndelivered({
      orderStatus: order.status,
      priorDeliveryCount
    })
  ) {
    throw new Error(
      "Only sent supplier orders without delivery evidence can be closed as undelivered."
    );
  }

  return repository.closeSupplierOrderUndelivered(
    normalizedRestaurantId,
    normalizedOrderId,
    normalizedReason
  );
}
