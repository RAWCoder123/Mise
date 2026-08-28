import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeliveryLinesFromOrderRecommendations,
  resolveDeliveryLineStorageLocationId
} from "../services/domain/supplierDelivery";
import type { InventoryItem, PurchaseRecommendation, SupplierOrder } from "../types/mise";

const restaurantId = "rest-1";
const orderId = "order-1";

function makeItem(overrides: Partial<InventoryItem> & Pick<InventoryItem, "id" | "item_name">): InventoryItem {
  return {
    restaurant_id: restaurantId,
    category: "produce",
    unit: "lb",
    current_quantity: 2,
    par_level: 5,
    reorder_threshold: 3,
    estimated_unit_cost: 1.5,
    supplier_id: "sup-1",
    supplier_name: "Fresh Co",
    last_updated: "2026-08-28T12:00:00.000Z",
    canonical_unit: "g",
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

function makeOrder(): SupplierOrder {
  return {
    id: orderId,
    restaurant_id: restaurantId,
    supplier_id: "sup-1",
    supplier_name: "Fresh Co",
    status: "sent",
    delivery_date: "2026-08-29",
    order_message: "Please deliver.",
    operator_note: null,
    created_at: "2026-08-28T10:00:00.000Z"
  };
}

function makeRecommendation(
  overrides: Partial<PurchaseRecommendation> & Pick<PurchaseRecommendation, "id" | "inventory_item_id" | "item_name">
): PurchaseRecommendation {
  return {
    restaurant_id: restaurantId,
    supplier_id: "sup-1",
    supplier_name: "Fresh Co",
    recommended_quantity: 4,
    unit: "lb",
    reason: "Low stock",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: orderId,
    created_at: "2026-08-28T10:00:00.000Z",
    ...overrides
  };
}

test("resolveDeliveryLineStorageLocationId prefers per-line override over default", () => {
  assert.equal(
    resolveDeliveryLineStorageLocationId({
      inventoryItemId: "item-a",
      storageLocationId: "loc-main",
      storageLocationIdsByItemId: { "item-a": "loc-walkin" }
    }),
    "loc-walkin"
  );
  assert.equal(
    resolveDeliveryLineStorageLocationId({
      inventoryItemId: "item-a",
      storageLocationId: "loc-main",
      storageLocationIdsByItemId: { "item-a": "  " }
    }),
    "loc-main"
  );
  assert.equal(
    resolveDeliveryLineStorageLocationId({
      inventoryItemId: "item-b",
      storageLocationId: null,
      storageLocationIdsByItemId: {}
    }),
    null
  );
});

test("buildDeliveryLinesFromOrderRecommendations stamps per-line put-away stations", () => {
  const itemA = makeItem({ id: "item-a", item_name: "Romaine" });
  const itemB = makeItem({ id: "item-b", item_name: "Avocado" });
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: makeOrder(),
    recommendations: [
      makeRecommendation({ id: "rec-a", inventory_item_id: itemA.id, item_name: itemA.item_name }),
      makeRecommendation({
        id: "rec-b",
        inventory_item_id: itemB.id,
        item_name: itemB.item_name,
        recommended_quantity: 6
      })
    ],
    inventoryItems: [itemA, itemB],
    requireVerifiedCanonicalUnit: true,
    storageLocationId: "loc-main",
    storageLocationIdsByItemId: {
      "item-b": "loc-line"
    }
  });

  assert.equal(built.lines.length, 2);
  assert.equal(built.lines[0]!.inventoryItemId, "item-a");
  assert.equal(built.lines[0]!.storageLocationId, "loc-main");
  assert.equal(built.lines[1]!.inventoryItemId, "item-b");
  assert.equal(built.lines[1]!.storageLocationId, "loc-line");
  assert.equal(built.skippedItemIds.length, 0);
});

test("buildDeliveryLinesFromOrderRecommendations omits storageLocationId when unresolved", () => {
  const item = makeItem({ id: "item-a", item_name: "Romaine" });
  const built = buildDeliveryLinesFromOrderRecommendations({
    order: makeOrder(),
    recommendations: [
      makeRecommendation({ id: "rec-a", inventory_item_id: item.id, item_name: item.item_name })
    ],
    inventoryItems: [item],
    requireVerifiedCanonicalUnit: false
  });
  assert.equal(built.lines.length, 1);
  assert.equal(built.lines[0]!.storageLocationId, undefined);
});
