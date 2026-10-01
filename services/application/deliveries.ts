import { fetchQueuedInventoryEvents } from "./deviceInventoryOutbox";
import {
  mergeDeliveryHistoryEntries,
  type DeliveryHistoryEntry
} from "./deliveryHistoryMerge";
import {
  buildRemainingDeliveryLines,
  canCloseSupplierOrderAcceptingShort,
  deliveryClientIdForOrder
} from "../domain/supplierDelivery";
import { getMiseRepository } from "./repository";

export type { DeliveryHistoryEntry } from "./deliveryHistoryMerge";
export { mergeDeliveryHistoryEntries } from "./deliveryHistoryMerge";

export class SupplierOrderReceiveBlockedError extends Error {
  readonly code: "nothing_remaining" | "order_not_receivable";

  constructor(code: "nothing_remaining" | "order_not_receivable", message: string) {
    super(message);
    this.name = "SupplierOrderReceiveBlockedError";
    this.code = code;
  }
}

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
 * Follow-up receives net against prior delivery evidence so already-accepted
 * or missing quantities are never posted again.
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
  const [order, recommendations, inventoryItems, history] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchPurchaseRecommendations(normalizedRestaurantId, "all"),
    repository.fetchInventoryItems(normalizedRestaurantId),
    repository.fetchSupplierDeliveryHistory(normalizedRestaurantId)
  ]);

  if (!order || order.restaurant_id !== normalizedRestaurantId) {
    throw new Error("Supplier order not found.");
  }
  if (order.status !== "sent" && order.status !== "completed") {
    throw new SupplierOrderReceiveBlockedError(
      "order_not_receivable",
      "Only sent orders can be received."
    );
  }

  let built = buildRemainingDeliveryLines({
    order,
    recommendations,
    inventoryItems,
    deliveries: history.deliveries,
    deliveryItems: history.items,
    requireVerifiedCanonicalUnit: true
  });
  if (built.lines.length === 0 && built.priorDeliveryCount === 0) {
    // Demo / incomplete unit setup: still allow as-ordered receive when items exist.
    built = buildRemainingDeliveryLines({
      order,
      recommendations,
      inventoryItems,
      deliveries: history.deliveries,
      deliveryItems: history.items,
      requireVerifiedCanonicalUnit: false
    });
  }
  if (built.lines.length === 0) {
    if (built.priorDeliveryCount > 0) {
      throw new SupplierOrderReceiveBlockedError(
        "nothing_remaining",
        "Nothing remains to receive on this supplier order. Close it to accept the short."
      );
    }
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
 * Completes a still-sent supplier order after prior delivery evidence without
 * writing another inventory receipt. Used when remaining quantity is accepted
 * as a short-ship (or already fully covered by received + missing).
 */
export async function closeSupplierOrderAcceptingShort(
  restaurantId: string,
  supplierOrderId: string
) {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = supplierOrderId.trim();
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

  if (
    !canCloseSupplierOrderAcceptingShort({
      orderStatus: order.status,
      priorDeliveryCount
    })
  ) {
    throw new Error(
      "Only sent supplier orders with prior delivery evidence can be closed as short-accepted."
    );
  }

  return repository.closeSupplierOrderAcceptingShort(normalizedRestaurantId, normalizedOrderId);
}
