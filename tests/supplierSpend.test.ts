import assert from "node:assert/strict";
import test from "node:test";

import { buildSupplierSpendTrend } from "../services/domain/supplierSpend";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

const restaurantId = "rest_1";
const supplierId = "00000000-0000-4000-8000-000000000501";

function inventory(id: string, cost: number): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: id,
    category: "Produce",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 5,
    supplier_id: supplierId,
    supplier_name: "Metro",
    estimated_unit_cost: cost,
    last_updated: "2026-07-20T12:00:00.000Z"
  };
}

function order(id: string, status: SupplierOrder["status"], createdAt: string): SupplierOrder {
  return {
    id,
    restaurant_id: restaurantId,
    supplier_id: supplierId,
    supplier_name: "Metro",
    message_locale: "en" as const,
    order_message: "hello",
    operator_note: null,
    status,
    delivery_date: "2026-07-21",
    created_at: createdAt
  };
}

function recommendation(
  orderId: string,
  itemId: string,
  quantity: number,
  status: PurchaseRecommendation["status"] = "ordered"
): PurchaseRecommendation {
  return {
    id: `rec_${orderId}_${itemId}`,
    restaurant_id: restaurantId,
    inventory_item_id: itemId,
    item_name: itemId,
    supplier_id: supplierId,
    supplier_name: "Metro",
    recommended_quantity: quantity,
    unit: "lb",
    reason: "low",
    urgency: "medium",
    status,
    supplier_order_id: orderId,
    created_at: "2026-07-20T12:00:00.000Z"
  };
}

test("supplier spend trend prices ordered lines by inventory unit cost and buckets by restaurant timezone", () => {
  const points = buildSupplierSpendTrend(
    restaurantId,
    [
      order("o1", "sent", "2026-07-20T22:30:00.000Z"),
      order("o2", "completed", "2026-07-21T18:00:00.000Z"),
      order("o3", "draft", "2026-07-21T19:00:00.000Z")
    ],
    [
      recommendation("o1", "item_a", 2),
      recommendation("o2", "item_a", 3),
      recommendation("o2", "item_b", 1),
      recommendation("o3", "item_a", 99)
    ],
    [inventory("item_a", 10), inventory("item_b", 4)],
    { timeZone: "America/New_York", limit: 6 }
  );

  assert.deepEqual(points, [
    { date: "2026-07-20", spend: 20 },
    { date: "2026-07-21", spend: 34 }
  ]);
});

test("supplier spend trend ignores unpriced lines and foreign restaurants", () => {
  const points = buildSupplierSpendTrend(
    restaurantId,
    [order("o1", "sent", "2026-07-21T12:00:00.000Z")],
    [
      recommendation("o1", "missing_item", 5),
      { ...recommendation("o1", "item_a", 2), restaurant_id: "other" }
    ],
    [inventory("item_a", 10)]
  );

  assert.deepEqual(points, []);
});
