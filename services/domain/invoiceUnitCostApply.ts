import type { InventoryItem } from "../../types/mise";
import type { SupplierDeliveryItemRecord, SupplierDeliveryRecord } from "./supplierReliability";

export type InvoiceUnitCostApplyRefusal =
  | "cross_tenant"
  | "item_mismatch"
  | "missing_unit_price"
  | "invalid_unit_price"
  | "zero_received"
  | "already_applied";

export type InvoiceUnitCostApplyProposal =
  | {
      ok: true;
      unitPrice: number;
      previousUnitCost: number;
      deliveryItemId: string;
      deliveryId: string;
      receivedAt: string;
    }
  | {
      ok: false;
      reason: InvoiceUnitCostApplyRefusal;
    };

export interface InvoiceUnitCostApplyResult {
  outcome: "applied" | "already_applied";
  inventoryItemId: string;
  deliveryItemId: string;
  deliveryId: string;
  unitPrice: number;
  previousUnitCost: number;
}

export interface InvoiceUnitCostApplyCandidate {
  deliveryItemId: string;
  deliveryId: string;
  receivedAt: string;
  unitPrice: number;
  previousUnitCost: number;
  displayUnit: string;
}

const UNIT_PRICE_MAX = 1_000_000;

/**
 * Invoice unit prices and estimated unit costs share the inventory item's
 * display/purchase unit. Compare at four decimal places so float noise does
 * not re-offer an already-applied price.
 */
export function normalizeInvoiceUnitPrice(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > UNIT_PRICE_MAX) {
    return null;
  }
  return roundUnitPrice(numeric);
}

export function roundUnitPrice(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function unitCostsMatch(left: number, right: number): boolean {
  return roundUnitPrice(left) === roundUnitPrice(right);
}

/**
 * Decides whether a single priced delivery line may rewrite an item's
 * estimated_unit_cost. Never invents a price: missing/invalid prices and
 * zero-received lines fail closed.
 */
export function proposeInvoiceUnitCostApply(input: {
  restaurantId: string;
  inventoryItem: Pick<InventoryItem, "id" | "restaurant_id" | "estimated_unit_cost" | "unit">;
  delivery: Pick<SupplierDeliveryRecord, "id" | "restaurant_id" | "received_at">;
  deliveryItem: Pick<
    SupplierDeliveryItemRecord,
    | "id"
    | "restaurant_id"
    | "delivery_id"
    | "inventory_item_id"
    | "received_quantity"
    | "unit_price"
  >;
}): InvoiceUnitCostApplyProposal {
  const restaurantId = input.restaurantId.trim();
  const itemId = input.inventoryItem.id.trim();
  if (
    !restaurantId ||
    input.inventoryItem.restaurant_id !== restaurantId ||
    input.delivery.restaurant_id !== restaurantId ||
    input.deliveryItem.restaurant_id !== restaurantId
  ) {
    return { ok: false, reason: "cross_tenant" };
  }
  if (
    !itemId ||
    input.deliveryItem.inventory_item_id !== itemId ||
    input.deliveryItem.delivery_id !== input.delivery.id
  ) {
    return { ok: false, reason: "item_mismatch" };
  }
  if (!(Number(input.deliveryItem.received_quantity) > 0)) {
    return { ok: false, reason: "zero_received" };
  }
  if (input.deliveryItem.unit_price == null) {
    return { ok: false, reason: "missing_unit_price" };
  }
  const unitPrice = normalizeInvoiceUnitPrice(input.deliveryItem.unit_price);
  if (unitPrice == null) {
    return { ok: false, reason: "invalid_unit_price" };
  }
  const previousUnitCost = Number.isFinite(input.inventoryItem.estimated_unit_cost)
    ? roundUnitPrice(input.inventoryItem.estimated_unit_cost)
    : 0;
  if (unitCostsMatch(previousUnitCost, unitPrice)) {
    return { ok: false, reason: "already_applied" };
  }
  return {
    ok: true,
    unitPrice,
    previousUnitCost,
    deliveryItemId: input.deliveryItem.id,
    deliveryId: input.delivery.id,
    receivedAt: input.delivery.received_at
  };
}

/**
 * Latest-first priced delivery line that can update the item's estimated unit cost.
 */
export function selectInvoiceUnitCostApplyCandidate(input: {
  restaurantId: string;
  inventoryItem: Pick<InventoryItem, "id" | "restaurant_id" | "estimated_unit_cost" | "unit">;
  deliveries: readonly SupplierDeliveryRecord[];
  deliveryItems: readonly SupplierDeliveryItemRecord[];
}): InvoiceUnitCostApplyCandidate | null {
  const deliveriesById = new Map(
    input.deliveries
      .filter((delivery) => delivery.restaurant_id === input.restaurantId)
      .map((delivery) => [delivery.id, delivery])
  );

  const ranked = [...input.deliveryItems]
    .filter(
      (item) =>
        item.restaurant_id === input.restaurantId &&
        item.inventory_item_id === input.inventoryItem.id &&
        deliveriesById.has(item.delivery_id)
    )
    .sort((left, right) => {
      const leftAt = deliveriesById.get(left.delivery_id)?.received_at ?? "";
      const rightAt = deliveriesById.get(right.delivery_id)?.received_at ?? "";
      return rightAt.localeCompare(leftAt);
    });

  for (const deliveryItem of ranked) {
    const delivery = deliveriesById.get(deliveryItem.delivery_id);
    if (!delivery) continue;
    const proposal = proposeInvoiceUnitCostApply({
      restaurantId: input.restaurantId,
      inventoryItem: input.inventoryItem,
      delivery,
      deliveryItem
    });
    if (!proposal.ok) continue;
    return {
      deliveryItemId: proposal.deliveryItemId,
      deliveryId: proposal.deliveryId,
      receivedAt: proposal.receivedAt,
      unitPrice: proposal.unitPrice,
      previousUnitCost: proposal.previousUnitCost,
      displayUnit: input.inventoryItem.unit.trim() || "unit"
    };
  }
  return null;
}
