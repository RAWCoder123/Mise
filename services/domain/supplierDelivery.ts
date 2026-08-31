import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";
import {
  requireOptionalInvoiceTotal,
  requireOptionalUnitPrice
} from "../miseValidation";

export interface DeliveryLineBuildResult {
  lines: SupplierDeliveryLineInput[];
  skippedItemIds: string[];
}

export interface DeliveryReceiveCostPreviewLine {
  inventoryItemId: string;
  itemName: string;
  displayUnit: string;
  orderedQuantity: number;
  canonicalUnit: "g" | "ml" | "each";
}

export interface DeliveryReceiveCostPreview {
  lines: DeliveryReceiveCostPreviewLine[];
  skippedItemIds: string[];
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
 * Read-only receive cost preview: as-ordered lines with display names so the
 * operator can optionally capture invoice total and per-line unit prices.
 */
export function buildDeliveryReceiveCostPreview(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  requireVerifiedCanonicalUnit?: boolean;
}): DeliveryReceiveCostPreview {
  const built = buildDeliveryLinesFromOrderRecommendations(input);
  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));

  return {
    skippedItemIds: built.skippedItemIds,
    lines: built.lines.map((line) => {
      const item = itemsById.get(line.inventoryItemId);
      return {
        inventoryItemId: line.inventoryItemId,
        itemName: item?.item_name ?? line.inventoryItemId,
        displayUnit: item?.unit?.trim() || line.canonicalUnit,
        orderedQuantity: line.orderedQuantity ?? line.receivedQuantity,
        canonicalUnit: line.canonicalUnit
      };
    })
  };
}

/**
 * Applies optional per-ordered-line unit prices. Unknown ordered IDs fail
 * closed. Blank/null clears the price; otherwise values must match the hosted
 * RPC bound.
 */
export function applyDeliveryLineUnitPrices(
  lines: readonly SupplierDeliveryLineInput[],
  unitPricesByOrderedItemId: Readonly<Record<string, number | string | null | undefined>>
): SupplierDeliveryLineInput[] {
  const knownOrderedIds = new Set(lines.map((line) => line.inventoryItemId));

  for (const orderedItemId of Object.keys(unitPricesByOrderedItemId)) {
    if (!knownOrderedIds.has(orderedItemId)) {
      throw new Error("Delivery unit price references an unknown ordered line.");
    }
  }

  return lines.map((line) => {
    if (!Object.prototype.hasOwnProperty.call(unitPricesByOrderedItemId, line.inventoryItemId)) {
      return {
        ...line,
        unitPrice: line.unitPrice ?? null
      };
    }

    return {
      ...line,
      unitPrice: requireOptionalUnitPrice(unitPricesByOrderedItemId[line.inventoryItemId])
    };
  });
}

/** Optional invoice total for the whole delivery; blank stays null. */
export function normalizeDeliveryInvoiceTotal(
  value: number | string | null | undefined
): number | null {
  return requireOptionalInvoiceTotal(value);
}

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}
