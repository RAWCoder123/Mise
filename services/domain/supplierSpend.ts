import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../../types/mise";
import { toDateKeyInTimeZone } from "../../utils/format";

export interface SupplierSpendTrendPoint {
  date: string;
  spend: number;
}

export interface SupplierSpendTrendOptions {
  limit?: number;
  timeZone?: string;
}

/**
 * Estimated spend per service date for sent/completed supplier orders,
 * priced from ordered recommendation quantities times the linked inventory
 * item's estimated unit cost. Orders whose line items cannot be priced
 * contribute nothing rather than inventing totals.
 */
export function buildSupplierSpendTrend(
  restaurantId: string,
  orders: readonly SupplierOrder[],
  recommendations: readonly PurchaseRecommendation[],
  inventoryItems: readonly InventoryItem[],
  options: SupplierSpendTrendOptions = {}
): SupplierSpendTrendPoint[] {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) return [];

  const pointLimit = typeof options.limit === "number" && Number.isFinite(options.limit)
    ? Math.max(1, Math.floor(options.limit))
    : 6;
  const timeZone = options.timeZone ?? "UTC";

  const unitCostByItemId = new Map<string, number>();
  inventoryItems.forEach((item) => {
    if (
      item.restaurant_id === normalizedRestaurantId &&
      Number.isFinite(item.estimated_unit_cost) &&
      item.estimated_unit_cost >= 0
    ) {
      unitCostByItemId.set(item.id, item.estimated_unit_cost);
    }
  });

  const spendByOrderId = new Map<string, number>();
  recommendations.forEach((recommendation) => {
    if (
      recommendation.restaurant_id !== normalizedRestaurantId ||
      recommendation.status !== "ordered" ||
      !recommendation.supplier_order_id ||
      !Number.isFinite(recommendation.recommended_quantity) ||
      recommendation.recommended_quantity <= 0
    ) {
      return;
    }
    const unitCost = unitCostByItemId.get(recommendation.inventory_item_id);
    if (unitCost === undefined) return;
    spendByOrderId.set(
      recommendation.supplier_order_id,
      (spendByOrderId.get(recommendation.supplier_order_id) ?? 0) +
        recommendation.recommended_quantity * unitCost
    );
  });

  const totalsByDate = new Map<string, number>();
  orders.forEach((order) => {
    if (
      order.restaurant_id !== normalizedRestaurantId ||
      (order.status !== "sent" && order.status !== "completed")
    ) {
      return;
    }
    const spend = spendByOrderId.get(order.id);
    if (spend === undefined || spend <= 0) return;
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) return;
    const date = toDateKeyInTimeZone(created, timeZone);
    totalsByDate.set(date, (totalsByDate.get(date) ?? 0) + spend);
  });

  return [...totalsByDate.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .slice(-pointLimit)
    .map(([date, spend]) => ({
      date,
      spend: Math.round(spend * 100) / 100
    }));
}
