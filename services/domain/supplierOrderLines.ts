import type {
  InventoryItem,
  PurchaseRecommendation,
  SupplierOrder,
  SupplierOrderLine
} from "../../types/mise";

export type { SupplierOrderLine };

export function isCanonicalInventoryUnit(
  value: string | null | undefined
): value is "g" | "ml" | "each" {
  return value === "g" || value === "ml" || value === "each";
}

/**
 * Builds durable order-line snapshots from linked approved/ordered
 * recommendations. Names, quantities, and optional costs are frozen at sync
 * time so later recommendation edits cannot silently rewrite sent history
 * without an explicit rebuild path.
 */
export function buildSupplierOrderLineSnapshots(input: {
  order: SupplierOrder;
  recommendations: PurchaseRecommendation[];
  inventoryItems: InventoryItem[];
  nowIso?: string;
  idFactory?: (inventoryItemId: string, recommendationId: string) => string;
}): SupplierOrderLine[] {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const inventoryById = new Map(
    input.inventoryItems
      .filter((item) => item.restaurant_id === input.order.restaurant_id)
      .map((item) => [item.id, item])
  );

  const linked = input.recommendations
    .filter(
      (recommendation) =>
        recommendation.restaurant_id === input.order.restaurant_id &&
        recommendation.supplier_order_id === input.order.id &&
        (recommendation.status === "approved" || recommendation.status === "ordered")
    )
    .slice()
    .sort(
      (left, right) =>
        left.item_name.localeCompare(right.item_name) || left.id.localeCompare(right.id)
    );

  return linked.map((recommendation, index) => {
    const inventory = inventoryById.get(recommendation.inventory_item_id);
    const id =
      input.idFactory?.(recommendation.inventory_item_id, recommendation.id) ??
      `${input.order.id}:${recommendation.inventory_item_id}`;
    return {
      id,
      restaurant_id: input.order.restaurant_id,
      supplier_order_id: input.order.id,
      inventory_item_id: recommendation.inventory_item_id,
      purchase_recommendation_id: recommendation.id,
      item_name: recommendation.item_name,
      ordered_quantity: recommendation.recommended_quantity,
      unit: recommendation.unit,
      canonical_unit: isCanonicalInventoryUnit(inventory?.canonical_unit)
        ? inventory.canonical_unit
        : null,
      estimated_unit_cost:
        typeof inventory?.estimated_unit_cost === "number" &&
        Number.isFinite(inventory.estimated_unit_cost)
          ? inventory.estimated_unit_cost
          : null,
      line_position: index,
      created_at: nowIso,
      updated_at: nowIso
    };
  });
}

export function replaceSupplierOrderLinesForOrder(
  existing: SupplierOrderLine[],
  restaurantId: string,
  orderId: string,
  nextLines: SupplierOrderLine[]
): SupplierOrderLine[] {
  return [
    ...existing.filter(
      (line) =>
        !(line.restaurant_id === restaurantId && line.supplier_order_id === orderId)
    ),
    ...nextLines
  ];
}
