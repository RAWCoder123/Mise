import { fetchQueuedInventoryEvents } from "./deviceInventoryOutbox";
import {
  mergeDeliveryHistoryEntries,
  type DeliveryHistoryEntry
} from "./deliveryHistoryMerge";
import {
  applyDeliveryLineSubstitutions,
  buildDeliveryLinesFromOrderRecommendations,
  buildDeliveryReceivePreview,
  deliveryClientIdForOrder,
  type DeliveryReceivePreview
} from "../domain/supplierDelivery";
import { getMiseRepository } from "./repository";

export type { DeliveryHistoryEntry } from "./deliveryHistoryMerge";
export { mergeDeliveryHistoryEntries } from "./deliveryHistoryMerge";
export type { DeliveryReceivePreview } from "../domain/supplierDelivery";

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

async function loadReceivableOrderContext(restaurantId: string, supplierOrderId: string) {
  const repository = getMiseRepository();
  const [order, recommendations, inventoryItems] = await Promise.all([
    repository.fetchSupplierOrder(restaurantId, supplierOrderId),
    repository.fetchPurchaseRecommendations(restaurantId, "all"),
    repository.fetchInventoryItems(restaurantId)
  ]);

  if (!order || order.restaurant_id !== restaurantId) {
    throw new Error("Supplier order not found.");
  }
  if (order.status !== "sent" && order.status !== "completed") {
    throw new Error("Only sent orders can be received.");
  }

  return { order, recommendations, inventoryItems };
}

function buildReceivableLines(input: {
  order: Awaited<ReturnType<typeof loadReceivableOrderContext>>["order"];
  recommendations: Awaited<ReturnType<typeof loadReceivableOrderContext>>["recommendations"];
  inventoryItems: Awaited<ReturnType<typeof loadReceivableOrderContext>>["inventoryItems"];
  substitutionsByOrderedItemId?: Readonly<Record<string, string | null | undefined>>;
}) {
  let built = buildDeliveryLinesFromOrderRecommendations({
    order: input.order,
    recommendations: input.recommendations,
    inventoryItems: input.inventoryItems,
    requireVerifiedCanonicalUnit: true
  });
  if (built.lines.length === 0) {
    // Demo / incomplete unit setup: still allow as-ordered receive when items exist.
    built = buildDeliveryLinesFromOrderRecommendations({
      order: input.order,
      recommendations: input.recommendations,
      inventoryItems: input.inventoryItems,
      requireVerifiedCanonicalUnit: false
    });
  }
  if (built.lines.length === 0) {
    throw new Error("No receivable lines are ready for this supplier order.");
  }

  const lines = input.substitutionsByOrderedItemId
    ? applyDeliveryLineSubstitutions(
        built.lines,
        input.substitutionsByOrderedItemId,
        input.inventoryItems
      )
    : built.lines;

  return { lines, skippedItemIds: built.skippedItemIds };
}

/**
 * Read-only receive preview: as-ordered lines plus eligible same-unit verified
 * substitutes. Does not write inventory or delivery evidence.
 */
export async function previewSupplierOrderDelivery(
  restaurantId: string,
  supplierOrderId: string
): Promise<DeliveryReceivePreview> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = supplierOrderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");

  const context = await loadReceivableOrderContext(normalizedRestaurantId, normalizedOrderId);
  let preview = buildDeliveryReceivePreview({
    ...context,
    requireVerifiedCanonicalUnit: true
  });
  if (preview.lines.length === 0) {
    preview = buildDeliveryReceivePreview({
      ...context,
      requireVerifiedCanonicalUnit: false
    });
  }
  return preview;
}

/**
 * Operator receive path: records a supplier delivery, projects inventory
 * receipts, and measures the related Mise action outcome when present.
 */
export async function receiveSupplierOrderDelivery(
  restaurantId: string,
  supplierOrderId: string,
  options: {
    notes?: string | null;
    receivedAt?: string;
    clientDeliveryId?: string;
    substitutionsByOrderedItemId?: Readonly<Record<string, string | null | undefined>>;
  } = {}
) {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedOrderId = supplierOrderId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedOrderId) throw new Error("Missing supplier order.");

  const repository = getMiseRepository();
  const context = await loadReceivableOrderContext(normalizedRestaurantId, normalizedOrderId);
  const { lines } = buildReceivableLines({
    ...context,
    substitutionsByOrderedItemId: options.substitutionsByOrderedItemId
  });

  const receivedAt = options.receivedAt ?? new Date().toISOString();
  const clientDeliveryId =
    options.clientDeliveryId?.trim() || deliveryClientIdForOrder(normalizedOrderId, receivedAt);

  return repository.recordSupplierOrderDelivery(normalizedRestaurantId, {
    supplierOrderId: normalizedOrderId,
    clientDeliveryId,
    receivedAt,
    lines,
    notes: options.notes ?? null
  });
}
