import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";

export interface DeliveryLineBuildResult {
  lines: SupplierDeliveryLineInput[];
  skippedItemIds: string[];
}

/**
 * Resolves put-away for one receive line: explicit per-item station wins,
 * otherwise the shared default. Blank values stay null (Main on apply).
 */
export function resolveDeliveryLineStorageLocationId(input: {
  inventoryItemId: string;
  storageLocationId?: string | null;
  storageLocationIdsByItemId?: Readonly<Record<string, string | null | undefined>>;
}): string | null {
  const rawLine = input.storageLocationIdsByItemId?.[input.inventoryItemId];
  if (typeof rawLine === "string" && rawLine.trim()) {
    return rawLine.trim();
  }
  if (typeof input.storageLocationId === "string" && input.storageLocationId.trim()) {
    return input.storageLocationId.trim();
  }
  return null;
}

/**
 * Builds idempotent as-ordered delivery lines from recommendations linked to a
 * supplier order. Hosted RPC requires verified canonical units; unverified
 * items are skipped and reported so the operator can finish unit setup.
 *
 * When storage locations exist, callers may stamp a shared default put-away
 * and optional per-line overrides. Each line carries its resolved
 * `storageLocationId` so demo and hosted put-away stay line-accurate.
 */
export function buildDeliveryLinesFromOrderRecommendations(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  requireVerifiedCanonicalUnit?: boolean;
  storageLocationId?: string | null;
  storageLocationIdsByItemId?: Readonly<Record<string, string | null | undefined>>;
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
    const storageLocationId = resolveDeliveryLineStorageLocationId({
      inventoryItemId: item.id,
      storageLocationId: input.storageLocationId,
      storageLocationIdsByItemId: input.storageLocationIdsByItemId
    });
    lines.push({
      inventoryItemId: item.id,
      orderedQuantity: quantity,
      receivedQuantity: quantity,
      damagedQuantity: 0,
      missingQuantity: 0,
      canonicalUnit: unit,
      substitutionInventoryItemId: null,
      unitPrice: null,
      discrepancyReason: null,
      ...(storageLocationId ? { storageLocationId } : {})
    });
  }

  return { lines, skippedItemIds };
}

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}
