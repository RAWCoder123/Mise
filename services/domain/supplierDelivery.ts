import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";

export interface DeliveryLineBuildResult {
  lines: SupplierDeliveryLineInput[];
  skippedItemIds: string[];
}

export interface DeliverySubstituteCandidate {
  id: string;
  itemName: string;
  unit: string;
  canonicalUnit: "g" | "ml" | "each";
}

export interface DeliveryReceivePreviewLine {
  inventoryItemId: string;
  itemName: string;
  orderedQuantity: number;
  canonicalUnit: "g" | "ml" | "each";
  eligibleSubstitutes: DeliverySubstituteCandidate[];
}

export interface DeliveryReceivePreview {
  lines: DeliveryReceivePreviewLine[];
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
 * Hosted `record_supplier_delivery` accepts a substitute only when it is a
 * different same-tenant item with a verified matching canonical unit.
 */
export function isEligibleDeliverySubstitute(
  orderedItem: InventoryItem,
  candidate: InventoryItem
): boolean {
  if (candidate.id === orderedItem.id) return false;
  if (candidate.restaurant_id !== orderedItem.restaurant_id) return false;
  if (candidate.canonical_unit_verification_status !== "verified") return false;
  const unit = candidate.canonical_unit;
  if (unit !== "g" && unit !== "ml" && unit !== "each") return false;
  if (orderedItem.canonical_unit !== unit) return false;
  return true;
}

export function listEligibleDeliverySubstitutes(
  orderedItem: InventoryItem,
  inventoryItems: readonly InventoryItem[]
): DeliverySubstituteCandidate[] {
  return inventoryItems
    .filter((candidate) => isEligibleDeliverySubstitute(orderedItem, candidate))
    .map((candidate) => ({
      id: candidate.id,
      itemName: candidate.item_name,
      unit: candidate.unit,
      canonicalUnit: candidate.canonical_unit as "g" | "ml" | "each"
    }))
    .sort((left, right) => left.itemName.localeCompare(right.itemName));
}

/**
 * Applies optional per-ordered-line substitutions. Unknown ordered IDs, blank
 * substitute IDs, and ineligible substitutes fail closed.
 */
export function applyDeliveryLineSubstitutions(
  lines: readonly SupplierDeliveryLineInput[],
  substitutionsByOrderedItemId: Readonly<Record<string, string | null | undefined>>,
  inventoryItems: readonly InventoryItem[]
): SupplierDeliveryLineInput[] {
  const itemsById = new Map(inventoryItems.map((item) => [item.id, item]));
  const knownOrderedIds = new Set(lines.map((line) => line.inventoryItemId));

  for (const orderedItemId of Object.keys(substitutionsByOrderedItemId)) {
    if (!knownOrderedIds.has(orderedItemId)) {
      throw new Error("Delivery substitution references an unknown ordered line.");
    }
  }

  return lines.map((line) => {
    if (!Object.prototype.hasOwnProperty.call(substitutionsByOrderedItemId, line.inventoryItemId)) {
      return {
        ...line,
        substitutionInventoryItemId: line.substitutionInventoryItemId ?? null
      };
    }

    const rawSubstituteId = substitutionsByOrderedItemId[line.inventoryItemId];
    if (rawSubstituteId == null || String(rawSubstituteId).trim() === "") {
      return {
        ...line,
        substitutionInventoryItemId: null
      };
    }

    const substituteId = String(rawSubstituteId).trim();
    const orderedItem = itemsById.get(line.inventoryItemId);
    const substituteItem = itemsById.get(substituteId);
    if (!orderedItem || !substituteItem || !isEligibleDeliverySubstitute(orderedItem, substituteItem)) {
      throw new Error("Delivery substitution is not verified.");
    }
    if (substituteItem.canonical_unit !== line.canonicalUnit) {
      throw new Error("Delivery substitution is not verified.");
    }

    return {
      ...line,
      substitutionInventoryItemId: substituteId
    };
  });
}

export function buildDeliveryReceivePreview(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
  requireVerifiedCanonicalUnit?: boolean;
}): DeliveryReceivePreview {
  const built = buildDeliveryLinesFromOrderRecommendations(input);
  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));

  return {
    skippedItemIds: built.skippedItemIds,
    lines: built.lines.map((line) => {
      const item = itemsById.get(line.inventoryItemId);
      return {
        inventoryItemId: line.inventoryItemId,
        itemName: item?.item_name ?? line.inventoryItemId,
        orderedQuantity: line.orderedQuantity ?? line.receivedQuantity,
        canonicalUnit: line.canonicalUnit,
        eligibleSubstitutes: item
          ? listEligibleDeliverySubstitutes(item, input.inventoryItems)
          : []
      };
    })
  };
}

/** Inventory item that should receive the net receipt for a delivery line. */
export function receiptInventoryItemIdForDeliveryLine(line: SupplierDeliveryLineInput): string {
  const substituteId = line.substitutionInventoryItemId?.trim();
  return substituteId || line.inventoryItemId;
}

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}
