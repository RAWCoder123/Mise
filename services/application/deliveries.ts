import { fetchQueuedInventoryEvents } from "./deviceInventoryOutbox";
import {
  mergeDeliveryHistoryEntries,
  type DeliveryHistoryEntry
} from "./deliveryHistoryMerge";
import {
  assertDurableSupplierOrderLinesPresent,
  assertReceivableDeliveryLines,
  buildDeliveryLinesFromSupplierOrderLines,
  deliveryClientIdForOrder
} from "../domain/supplierDelivery";
import { getMiseRepository } from "./repository";

export type { DeliveryHistoryEntry } from "./deliveryHistoryMerge";
export { mergeDeliveryHistoryEntries } from "./deliveryHistoryMerge";
export {
  isSupplierDeliveryLinesSkippedError,
  isSupplierOrderLinesMissingError,
  SUPPLIER_DELIVERY_LINES_SKIPPED_CODE,
  SUPPLIER_ORDER_LINES_MISSING_CODE,
  SupplierDeliveryLinesSkippedError,
  SupplierOrderLinesMissingError
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
 * Operator receive path: records a supplier delivery, projects inventory
 * receipts, and measures the related Mise action outcome when present.
 *
 * Ordered quantities come from durable `supplier_order_lines` snapshots so
 * later recommendation edits cannot rewrite what was approved/sent.
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
  const [order, orderLines, inventoryItems] = await Promise.all([
    repository.fetchSupplierOrder(normalizedRestaurantId, normalizedOrderId),
    repository.fetchSupplierOrderLines(normalizedRestaurantId, normalizedOrderId),
    repository.fetchInventoryItems(normalizedRestaurantId)
  ]);

  if (!order || order.restaurant_id !== normalizedRestaurantId) {
    throw new Error("Supplier order not found.");
  }
  if (order.status !== "sent" && order.status !== "completed") {
    throw new Error("Only sent orders can be received.");
  }

  assertDurableSupplierOrderLinesPresent(orderLines);

  const built = buildDeliveryLinesFromSupplierOrderLines({
    order,
    orderLines,
    inventoryItems,
    requireVerifiedCanonicalUnit: true
  });
  // Never fall back to unverified units, never rebuild from live recommendations,
  // and never silently receive a verified subset while other ordered lines are skipped.
  assertReceivableDeliveryLines({ built, inventoryItems });
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
