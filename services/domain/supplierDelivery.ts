import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import { operatingLimits } from "../miseValidation";
import type { SupplierDeliveryLineInput } from "../repositories/repositoryContracts";

export interface DeliveryLineBuildResult {
  lines: SupplierDeliveryLineInput[];
  skippedItemIds: string[];
}

/** Operator edits applied on top of as-ordered delivery lines before record. */
export interface SupplierDeliveryLineAdjustment {
  inventoryItemId: string;
  receivedQuantity: number;
  damagedQuantity?: number;
  /** When omitted, short-ships derive missing as max(0, ordered − received). */
  missingQuantity?: number;
  discrepancyReason?: string | null;
}

/** Screen-facing preview of one receivable supplier-order line. */
export interface SupplierDeliveryReceivePreviewLine {
  inventoryItemId: string;
  itemName: string;
  displayUnit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  canonicalUnit: "g" | "ml" | "each";
  discrepancyReason: string | null;
}

export interface SupplierDeliveryReceivePreview {
  lines: SupplierDeliveryReceivePreviewLine[];
  skippedItemIds: string[];
}

const QUANTITY_LIMIT = operatingLimits.recommendationQuantity;
const REASON_LIMIT = 500;

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
 * Preview lines for the receive checklist. Uses verified units when possible,
 * then falls back so demo / incomplete unit setup still surfaces ordered lines.
 */
export function buildSupplierDeliveryReceivePreview(input: {
  order: SupplierOrder;
  recommendations: readonly PurchaseRecommendation[];
  inventoryItems: readonly InventoryItem[];
}): SupplierDeliveryReceivePreview {
  let built = buildDeliveryLinesFromOrderRecommendations({
    ...input,
    requireVerifiedCanonicalUnit: true
  });
  if (built.lines.length === 0) {
    built = buildDeliveryLinesFromOrderRecommendations({
      ...input,
      requireVerifiedCanonicalUnit: false
    });
  }

  const itemsById = new Map(input.inventoryItems.map((item) => [item.id, item]));
  const lines: SupplierDeliveryReceivePreviewLine[] = built.lines.map((line) => {
    const item = itemsById.get(line.inventoryItemId);
    return {
      inventoryItemId: line.inventoryItemId,
      itemName: item?.item_name?.trim() || line.inventoryItemId,
      displayUnit: item?.unit?.trim() || line.canonicalUnit,
      orderedQuantity: line.orderedQuantity ?? 0,
      receivedQuantity: line.receivedQuantity,
      damagedQuantity: line.damagedQuantity ?? 0,
      missingQuantity: line.missingQuantity ?? 0,
      canonicalUnit: line.canonicalUnit,
      discrepancyReason: line.discrepancyReason ?? null
    };
  });

  return { lines, skippedItemIds: built.skippedItemIds };
}

/**
 * Merges operator discrepancy edits onto as-ordered lines. Unknown adjustment
 * item ids are rejected so a stale form cannot invent receivable inventory.
 */
export function applyDeliveryLineAdjustments(
  lines: readonly SupplierDeliveryLineInput[],
  adjustments: readonly SupplierDeliveryLineAdjustment[]
): SupplierDeliveryLineInput[] {
  if (adjustments.length === 0) {
    return lines.map((line) => ({ ...line }));
  }

  const byItemId = new Map(lines.map((line) => [line.inventoryItemId, line]));
  for (const adjustment of adjustments) {
    const itemId = adjustment.inventoryItemId.trim();
    if (!itemId || !byItemId.has(itemId)) {
      throw new Error("Delivery adjustment targets an unknown receivable line.");
    }
  }

  const adjustmentsByItemId = new Map(
    adjustments.map((adjustment) => [adjustment.inventoryItemId.trim(), adjustment] as const)
  );

  return lines.map((line) => {
    const adjustment = adjustmentsByItemId.get(line.inventoryItemId);
    if (!adjustment) return { ...line };
    return normalizeDeliveryLineDiscrepancy(line, adjustment);
  });
}

export function normalizeDeliveryLineDiscrepancy(
  line: SupplierDeliveryLineInput,
  adjustment: SupplierDeliveryLineAdjustment
): SupplierDeliveryLineInput {
  const orderedQuantity = Math.max(0, Number(line.orderedQuantity) || 0);
  const receivedQuantity = requireBoundedQuantity(
    adjustment.receivedQuantity,
    "Received quantity"
  );
  const damagedQuantity = requireBoundedQuantity(
    adjustment.damagedQuantity ?? 0,
    "Damaged quantity"
  );
  if (damagedQuantity > receivedQuantity) {
    throw new Error("Damaged quantity cannot exceed received quantity.");
  }

  const explicitMissing =
    adjustment.missingQuantity === undefined
      ? null
      : requireBoundedQuantity(adjustment.missingQuantity, "Missing quantity");
  const missingQuantity =
    explicitMissing ?? Math.max(0, roundQuantity(orderedQuantity - receivedQuantity));

  const discrepancyReason = normalizeDiscrepancyReason(adjustment.discrepancyReason);

  return {
    ...line,
    orderedQuantity,
    receivedQuantity,
    damagedQuantity,
    missingQuantity,
    discrepancyReason
  };
}

export function deliveryLineHasDiscrepancy(line: SupplierDeliveryLineInput): boolean {
  const ordered = Math.max(0, Number(line.orderedQuantity) || 0);
  const received = Math.max(0, Number(line.receivedQuantity) || 0);
  return (
    (line.damagedQuantity ?? 0) > 0 ||
    (line.missingQuantity ?? 0) > 0 ||
    Boolean(line.discrepancyReason) ||
    roundQuantity(received) !== roundQuantity(ordered)
  );
}

export function deliveryClientIdForOrder(orderId: string, receivedAt: string): string {
  return `supplier_delivery:${orderId.trim()}:${receivedAt}`;
}

function requireBoundedQuantity(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > QUANTITY_LIMIT) {
    throw new Error(`${label} must be between 0 and ${QUANTITY_LIMIT.toLocaleString()}.`);
  }
  return roundQuantity(value);
}

function normalizeDiscrepancyReason(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().slice(0, REASON_LIMIT);
  return trimmed.length > 0 ? trimmed : null;
}

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}
