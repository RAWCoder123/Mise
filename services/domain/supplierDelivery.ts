import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";

export const SUPPLIER_DELIVERY_LINES_SKIPPED_CODE = "supplier_delivery_lines_skipped" as const;

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

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}
