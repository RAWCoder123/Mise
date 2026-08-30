import assert from "node:assert/strict";
import test from "node:test";

import { linkedApprovedRecommendationsForOrder } from "../services/domain/miseDomain";
import type { PurchaseRecommendation } from "../types/mise";

const restaurantId = "rest_order_lines";
const orderId = "order_draft_1";

function recommendation(
  id: string,
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: restaurantId,
    inventory_item_id: `item_${id}`,
    item_name: overrides.item_name ?? id,
    supplier_id: "supplier_1",
    supplier_name: "Fresh Co",
    unit: "cs",
    recommended_quantity: 2,
    reason: "test",
    urgency: "medium",
    status: "approved",
    supplier_order_id: orderId,
    created_at: "2026-08-30T12:00:00.000Z",
    ...overrides
  };
}

test("linkedApprovedRecommendationsForOrder keeps only approved lines for the draft", () => {
  const linked = linkedApprovedRecommendationsForOrder(restaurantId, orderId, [
    recommendation("peppers", { item_name: "Peppers" }),
    recommendation("onions", { item_name: "Onions" }),
    recommendation("dismissed", {
      item_name: "Dismissed",
      status: "dismissed",
      supplier_order_id: null
    }),
    recommendation("other_order", {
      item_name: "Other draft",
      supplier_order_id: "order_draft_2"
    }),
    recommendation("foreign", {
      item_name: "Foreign",
      restaurant_id: "other_restaurant"
    }),
    recommendation("ordered", {
      item_name: "Already sent",
      status: "ordered"
    })
  ]);

  assert.deepEqual(
    linked.map((entry) => entry.item_name),
    ["Onions", "Peppers"]
  );
});

test("linkedApprovedRecommendationsForOrder fails closed on blank ids", () => {
  assert.deepEqual(
    linkedApprovedRecommendationsForOrder(" ", orderId, [recommendation("onions")]),
    []
  );
  assert.deepEqual(
    linkedApprovedRecommendationsForOrder(restaurantId, " ", [recommendation("onions")]),
    []
  );
});
