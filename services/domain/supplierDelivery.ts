import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";
import type {
  SupplierDeliveryItemRecord,
  SupplierDeliveryRecord
} from "./supplierReliability";

export interface DeliveryLineBuildResult {
  lines: SupplierDeliveryLineInput[];
  skippedItemIds: string[];
}

export interface PriorDeliveryCoverage {
  inventoryItemId: string;
  /** Sum of received_quantity across prior deliveries for this item. */
  priorReceivedQuantity: number;
  /** Sum of missing_quantity across prior deliveries for this item. */
  priorMissingQuantity: number;
  /** Sum of ordered_quantity hints from prior lines (max used as fallback). */
  priorOrderedHint: number;
}

export interface SupplierOrderReceiveOutlook {
  priorDeliveryCount: number;
  remainingLineCount: number;
  remainingQuantityTotal: number;
  canReceiveRemaining: boolean;
  canCloseAcceptingShort: boolean;
}

/**
 * Builds idempotent as-ordered delivery lines from recommendations linked to a
 * supplier order. Hosted RPC requires verified canonical units; unverified
 * items are skipped and reported so the operator can finish unit setup.
 */
export function buildDeliveryLinesFromOrderRecommendations(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  requireVerifiedCanonicalUnit?: boolean;
}): DeliveryLineBuildResult {
  const requireVerified = input.requireVerifiedCanonicalUnit !== false;
  const linked = input.recommendations.filter(
    (recommendation) =>
      recommendation.restaurant_id === input.order.restaurant_id &&
      recommendation.supplier_order_id === input.order.id &&
      (recommendation.status === "ordered" || recommendation.status === "approved")
  );

  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const lines: SupplierDeliveryLineInput[] = [];
  const skippedItemIds: string[] = [];

  for (const recommendation of linked) {
    const item = itemsById.get(recommendation.inventory_item_id);
    if (!item || item.restaurant_id !== input.order.restaurant_id) {
      skippedItemIds.push(recommendation.inventory_item_id);
      continue;
    }
    const verified = item.canonical_unit_verification_status === "verified";
    const unit =
      item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each"
        ? item.canonical_unit
        : requireVerified
          ? null
          : ("each" as const);
    if (!unit || (requireVerified && !verified)) {
      skippedItemIds.push(item.id);
      continue;
    }
    const quantity = Math.max(0, Number(recommendation.recommended_quantity) || 0);
    lines.push({
      inventoryItemId: item.id,
      orderedQuantity: quantity,
      receivedQuantity: quantity,
      damagedQuantity: 0,
      missingQuantity: 0,
      canonicalUnit: unit,
      substitutionInventoryItemId: null,
      unitPrice: null,
      discrepancyReason: null
    });
  }

  return { lines, skippedItemIds };
}

/**
 * Sums prior delivery coverage for one supplier order. Remaining quantity for
 * an ordered line is ordered − received − missing (never negative).
 */
export function sumPriorDeliveryCoverage(input: {
  restaurantId: string;
  supplierOrderId: string;
  deliveries: readonly SupplierDeliveryRecord[];
  items: readonly SupplierDeliveryItemRecord[];
}): Map<string, PriorDeliveryCoverage> {
  const restaurantId = input.restaurantId.trim();
  const supplierOrderId = input.supplierOrderId.trim();
  const coverage = new Map<string, PriorDeliveryCoverage>();
  if (!restaurantId || !supplierOrderId) return coverage;

  const deliveryIds = new Set(
    input.deliveries
      .filter(
        (delivery) =>
          delivery.restaurant_id === restaurantId &&
          delivery.supplier_order_id === supplierOrderId
      )
      .map((delivery) => delivery.id)
  );

  for (const item of input.items) {
    if (item.restaurant_id !== restaurantId || !deliveryIds.has(item.delivery_id)) continue;
    const inventoryItemId = item.inventory_item_id.trim();
    if (!inventoryItemId) continue;
    const current = coverage.get(inventoryItemId) ?? {
      inventoryItemId,
      priorReceivedQuantity: 0,
      priorMissingQuantity: 0,
      priorOrderedHint: 0
    };
    current.priorReceivedQuantity += finiteNonNegative(item.received_quantity);
    current.priorMissingQuantity += finiteNonNegative(item.missing_quantity);
    const orderedHint = finiteNonNegative(item.ordered_quantity);
    if (orderedHint > current.priorOrderedHint) current.priorOrderedHint = orderedHint;
    coverage.set(inventoryItemId, current);
  }

  return coverage;
}

export function remainingQuantityForCoverage(
  orderedQuantity: number,
  coverage: PriorDeliveryCoverage | undefined
): number {
  const ordered = Math.max(0, orderedQuantity);
  if (!coverage) return ordered;
  return Math.max(
    0,
    ordered - coverage.priorReceivedQuantity - coverage.priorMissingQuantity
  );
}

/**
 * Nets as-ordered recommendation lines against prior delivery evidence so a
 * follow-up receive cannot re-post inventory already accepted or marked missing.
 */
export function buildRemainingDeliveryLines(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  deliveries: readonly SupplierDeliveryRecord[];
  deliveryItems: readonly SupplierDeliveryItemRecord[];
  requireVerifiedCanonicalUnit?: boolean;
}): DeliveryLineBuildResult & {
  priorDeliveryCount: number;
  remainingQuantityTotal: number;
} {
  const priorDeliveries = input.deliveries.filter(
    (delivery) =>
      delivery.restaurant_id === input.order.restaurant_id &&
      delivery.supplier_order_id === input.order.id
  );
  const coverage = sumPriorDeliveryCoverage({
    restaurantId: input.order.restaurant_id,
    supplierOrderId: input.order.id,
    deliveries: input.deliveries,
    items: input.deliveryItems
  });

  const built = buildDeliveryLinesFromOrderRecommendations({
    order: input.order,
    recommendations: input.recommendations,
    inventoryItems: input.inventoryItems,
    requireVerifiedCanonicalUnit: input.requireVerifiedCanonicalUnit
  });

  if (priorDeliveries.length === 0) {
    return {
      ...built,
      priorDeliveryCount: 0,
      remainingQuantityTotal: built.lines.reduce(
        (sum, line) => sum + Math.max(0, Number(line.receivedQuantity) || 0),
        0
      )
    };
  }

  const lines: SupplierDeliveryLineInput[] = [];
  let remainingQuantityTotal = 0;
  for (const line of built.lines) {
    const ordered = Math.max(0, Number(line.orderedQuantity) || 0);
    const remaining = remainingQuantityForCoverage(ordered, coverage.get(line.inventoryItemId));
    if (remaining <= 0) continue;
    remainingQuantityTotal += remaining;
    lines.push({
      ...line,
      orderedQuantity: remaining,
      receivedQuantity: remaining,
      damagedQuantity: 0,
      missingQuantity: 0,
      discrepancyReason: null
    });
  }

  return {
    lines,
    skippedItemIds: built.skippedItemIds,
    priorDeliveryCount: priorDeliveries.length,
    remainingQuantityTotal
  };
}

export function buildSupplierOrderReceiveOutlook(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  deliveries: readonly SupplierDeliveryRecord[];
  deliveryItems: readonly SupplierDeliveryItemRecord[];
}): SupplierOrderReceiveOutlook {
  if (input.order.status !== "sent") {
    return {
      priorDeliveryCount: 0,
      remainingLineCount: 0,
      remainingQuantityTotal: 0,
      canReceiveRemaining: false,
      canCloseAcceptingShort: false
    };
  }

  let remaining = buildRemainingDeliveryLines({
    ...input,
    requireVerifiedCanonicalUnit: true
  });
  if (remaining.lines.length === 0 && remaining.priorDeliveryCount === 0) {
    remaining = buildRemainingDeliveryLines({
      ...input,
      requireVerifiedCanonicalUnit: false
    });
  }

  const canCloseAcceptingShort = canCloseSupplierOrderAcceptingShort({
    orderStatus: input.order.status,
    priorDeliveryCount: remaining.priorDeliveryCount
  });

  return {
    priorDeliveryCount: remaining.priorDeliveryCount,
    remainingLineCount: remaining.lines.length,
    remainingQuantityTotal: remaining.remainingQuantityTotal,
    canReceiveRemaining: remaining.lines.length > 0,
    canCloseAcceptingShort
  };
}

/**
 * Managers may close a still-sent order only after at least one delivery was
 * recorded against it. Closing accepts any uncovered short without writing
 * another receipt.
 */
export function canCloseSupplierOrderAcceptingShort(input: {
  orderStatus: string;
  priorDeliveryCount: number;
}): boolean {
  return input.orderStatus === "sent" && input.priorDeliveryCount > 0;
}

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}

function finiteNonNegative(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}
