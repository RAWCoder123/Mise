import type {
  InventoryItem,
  PurchaseRecommendation,
  SupplierOrder,
  SupplierOrderLine
} from "../../types/mise";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";

export const SUPPLIER_DELIVERY_LINES_SKIPPED_CODE = "supplier_delivery_lines_skipped" as const;
export const SUPPLIER_ORDER_LINES_MISSING_CODE = "supplier_order_lines_missing" as const;

export interface DeliveryLineBuildResult {
  lines: SupplierDeliveryLineInput[];
  skippedItemIds: string[];
}

export class SupplierDeliveryLinesSkippedError extends Error {
  readonly code = SUPPLIER_DELIVERY_LINES_SKIPPED_CODE;
  readonly skippedItemIds: readonly string[];
  readonly skippedItemNames: readonly string[];

  constructor(skippedItemIds: readonly string[], skippedItemNames: readonly string[]) {
    const uniqueNames = [...new Set(skippedItemNames.map((name) => name.trim()).filter(Boolean))];
    super(
      uniqueNames.length > 0
        ? `Cannot receive until verified units exist for: ${uniqueNames.join(", ")}.`
        : "Cannot receive until every ordered line has a verified canonical unit."
    );
    this.name = "SupplierDeliveryLinesSkippedError";
    this.skippedItemIds = [...skippedItemIds];
    this.skippedItemNames = uniqueNames;
  }
}

export class SupplierOrderLinesMissingError extends Error {
  readonly code = SUPPLIER_ORDER_LINES_MISSING_CODE;

  constructor() {
    super("No durable supplier order lines are available for this order.");
    this.name = "SupplierOrderLinesMissingError";
  }
}

export function isSupplierDeliveryLinesSkippedError(
  error: unknown
): error is SupplierDeliveryLinesSkippedError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === SUPPLIER_DELIVERY_LINES_SKIPPED_CODE ||
    candidate.name === "SupplierDeliveryLinesSkippedError"
  );
}

export function isSupplierOrderLinesMissingError(
  error: unknown
): error is SupplierOrderLinesMissingError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    candidate.code === SUPPLIER_ORDER_LINES_MISSING_CODE ||
    candidate.name === "SupplierOrderLinesMissingError"
  );
}

function resolveReceivableCanonicalUnit(input: {
  item: InventoryItem;
  requireVerified: boolean;
}): "g" | "ml" | "each" | null {
  const verified = input.item.canonical_unit_verification_status === "verified";
  const unit =
    input.item.canonical_unit === "g" ||
    input.item.canonical_unit === "ml" ||
    input.item.canonical_unit === "each"
      ? input.item.canonical_unit
      : input.requireVerified
        ? null
        : ("each" as const);
  if (!unit || (input.requireVerified && !verified)) {
    return null;
  }
  return unit;
}

/**
 * Builds as-ordered delivery lines from durable supplier order line snapshots.
 * Ordered quantities come from the frozen lines, never from live recommendation
 * edits. Hosted receive requires verified canonical units on each inventory item.
 */
export function buildDeliveryLinesFromSupplierOrderLines(input: {
  order: SupplierOrder;
  orderLines: readonly SupplierOrderLine[];
  inventoryItems: readonly InventoryItem[];
  requireVerifiedCanonicalUnit?: boolean;
}): DeliveryLineBuildResult {
  const requireVerified = input.requireVerifiedCanonicalUnit !== false;
  const linked = input.orderLines
    .filter(
      (line) =>
        line.restaurant_id === input.order.restaurant_id &&
        line.supplier_order_id === input.order.id
    )
    .slice()
    .sort(
      (left, right) =>
        left.line_position - right.line_position || left.id.localeCompare(right.id)
    );

  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const lines: SupplierDeliveryLineInput[] = [];
  const skippedItemIds: string[] = [];

  for (const orderLine of linked) {
    const item = itemsById.get(orderLine.inventory_item_id);
    if (!item || item.restaurant_id !== input.order.restaurant_id) {
      skippedItemIds.push(orderLine.inventory_item_id);
      continue;
    }
    const unit = resolveReceivableCanonicalUnit({ item, requireVerified });
    if (!unit) {
      skippedItemIds.push(item.id);
      continue;
    }
    const quantity = Math.max(0, Number(orderLine.ordered_quantity) || 0);
    if (!(quantity > 0)) {
      skippedItemIds.push(item.id);
      continue;
    }
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
 * Legacy builder from live recommendations. Receive must not use this for
 * sent/completed orders once durable lines exist; kept for focused unit tests
 * and migration-era comparisons.
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
    const unit = resolveReceivableCanonicalUnit({ item, requireVerified });
    if (!unit) {
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
 * Fail closed when any ordered line cannot be received with a verified unit.
 * Silent partial receives understate on-hand inventory.
 */
export function assertReceivableDeliveryLines(input: {
  built: DeliveryLineBuildResult;
  inventoryItems: readonly InventoryItem[];
}): void {
  const skippedIds = [...new Set(input.built.skippedItemIds.map((id) => id.trim()).filter(Boolean))];
  if (skippedIds.length === 0) return;

  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const skippedNames = skippedIds.map((id) => {
    const item = itemsById.get(id);
    return item?.item_name?.trim() || id;
  });

  throw new SupplierDeliveryLinesSkippedError(skippedIds, skippedNames);
}

/**
 * Sent and completed orders must carry durable line snapshots. Never rebuild
 * ordered quantities from live recommendations when the snapshot is absent.
 */
export function assertDurableSupplierOrderLinesPresent(
  orderLines: readonly SupplierOrderLine[]
): void {
  if (orderLines.length === 0) {
    throw new SupplierOrderLinesMissingError();
  }
}

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}
