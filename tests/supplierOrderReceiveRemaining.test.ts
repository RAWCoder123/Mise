import assert from "node:assert/strict";
import test from "node:test";

import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";
import {
  buildRemainingDeliveryLines,
  buildSupplierOrderReceiveOutlook,
  canCloseSupplierOrderAcceptingShort,
  remainingQuantityForCoverage,
  sumPriorDeliveryCoverage
} from "../services/domain/supplierDelivery";
import { normalizeInventoryItem } from "../services/miseValidation";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";
import type {
  SupplierDeliveryItemRecord,
  SupplierDeliveryRecord
} from "../services/domain/supplierReliability";

const FIXED_NOW = "2026-08-02T16:00:00.000Z";

function sentOrder(itemSupplierId: string, itemSupplierName: string): SupplierOrder {
  return {
    id: "order-sent-remaining-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_id: itemSupplierId,
    supplier_name: itemSupplierName,
    order_message: "Order",
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-02",
    created_at: "2026-08-01T12:00:00.000Z"
  };
}

test("remaining quantity nets received and missing against ordered", () => {
  assert.equal(
    remainingQuantityForCoverage(18, {
      inventoryItemId: "item-1",
      priorReceivedQuantity: 10,
      priorMissingQuantity: 0,
      priorOrderedHint: 18
    }),
    8
  );
  assert.equal(
    remainingQuantityForCoverage(18, {
      inventoryItemId: "item-1",
      priorReceivedQuantity: 15,
      priorMissingQuantity: 3,
      priorOrderedHint: 18
    }),
    0
  );
  assert.equal(remainingQuantityForCoverage(12, undefined), 12);
});

test("buildRemainingDeliveryLines fails closed on re-receive of covered qty", () => {
  const state = createInitialDemoState("Toast", undefined, new Date(FIXED_NOW));
  const item = normalizeInventoryItem(state.inventoryItems[0]!);
  const order = sentOrder(item.supplier_id, item.supplier_name);
  const recommendation: PurchaseRecommendation = {
    id: "rec-ordered-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    recommended_quantity: 10,
    unit: item.unit,
    reason: "Included in the sent order.",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: order.id,
    created_at: order.created_at
  };

  const firstPass = buildRemainingDeliveryLines({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    deliveries: [],
    deliveryItems: [],
    requireVerifiedCanonicalUnit: false
  });
  assert.equal(firstPass.lines.length, 1);
  assert.equal(firstPass.lines[0]!.receivedQuantity, 10);
  assert.equal(firstPass.priorDeliveryCount, 0);

  const priorDelivery: SupplierDeliveryRecord = {
    id: "delivery-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_order_id: order.id,
    status: "partially_received",
    received_at: FIXED_NOW,
    notes: null,
    created_at: FIXED_NOW
  };
  const priorItem: SupplierDeliveryItemRecord = {
    id: "delivery-1:1",
    restaurant_id: DEMO_RESTAURANT_ID,
    delivery_id: priorDelivery.id,
    inventory_item_id: item.id,
    ordered_quantity: 10,
    received_quantity: 6,
    damaged_quantity: 0,
    missing_quantity: 0,
    canonical_unit: item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each"
      ? item.canonical_unit
      : "each"
  };

  const secondPass = buildRemainingDeliveryLines({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    deliveries: [priorDelivery],
    deliveryItems: [priorItem],
    requireVerifiedCanonicalUnit: false
  });
  assert.equal(secondPass.priorDeliveryCount, 1);
  assert.equal(secondPass.lines.length, 1);
  assert.equal(secondPass.lines[0]!.orderedQuantity, 4);
  assert.equal(secondPass.lines[0]!.receivedQuantity, 4);
  assert.equal(secondPass.remainingQuantityTotal, 4);

  const coveredItem: SupplierDeliveryItemRecord = {
    ...priorItem,
    received_quantity: 7,
    missing_quantity: 3
  };
  const thirdPass = buildRemainingDeliveryLines({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    deliveries: [priorDelivery],
    deliveryItems: [coveredItem],
    requireVerifiedCanonicalUnit: false
  });
  assert.equal(thirdPass.lines.length, 0);
  assert.equal(thirdPass.remainingQuantityTotal, 0);
  assert.equal(thirdPass.priorDeliveryCount, 1);
});

test("receive outlook exposes close-after-short only with prior deliveries", () => {
  const state = createInitialDemoState("Toast", undefined, new Date(FIXED_NOW));
  const item = normalizeInventoryItem(state.inventoryItems[0]!);
  const order = sentOrder(item.supplier_id, item.supplier_name);
  const recommendation: PurchaseRecommendation = {
    id: "rec-ordered-2",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    recommended_quantity: 8,
    unit: item.unit,
    reason: "Included.",
    urgency: "medium",
    status: "ordered",
    supplier_order_id: order.id,
    created_at: order.created_at
  };

  const withoutPrior = buildSupplierOrderReceiveOutlook({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    deliveries: [],
    deliveryItems: []
  });
  assert.equal(withoutPrior.canReceiveRemaining, true);
  assert.equal(withoutPrior.canCloseAcceptingShort, false);
  assert.equal(withoutPrior.priorDeliveryCount, 0);

  const priorDelivery: SupplierDeliveryRecord = {
    id: "delivery-2",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_order_id: order.id,
    status: "discrepancy",
    received_at: FIXED_NOW,
    notes: "Short",
    created_at: FIXED_NOW
  };
  const priorItem: SupplierDeliveryItemRecord = {
    id: "delivery-2:1",
    restaurant_id: DEMO_RESTAURANT_ID,
    delivery_id: priorDelivery.id,
    inventory_item_id: item.id,
    ordered_quantity: 8,
    received_quantity: 5,
    damaged_quantity: 0,
    missing_quantity: 3,
    canonical_unit: "each"
  };

  const withPriorCovered = buildSupplierOrderReceiveOutlook({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    deliveries: [priorDelivery],
    deliveryItems: [priorItem]
  });
  assert.equal(withPriorCovered.canReceiveRemaining, false);
  assert.equal(withPriorCovered.canCloseAcceptingShort, true);
  assert.equal(withPriorCovered.remainingLineCount, 0);

  assert.equal(
    canCloseSupplierOrderAcceptingShort({ orderStatus: "sent", priorDeliveryCount: 1 }),
    true
  );
  assert.equal(
    canCloseSupplierOrderAcceptingShort({ orderStatus: "sent", priorDeliveryCount: 0 }),
    false
  );
  assert.equal(
    canCloseSupplierOrderAcceptingShort({ orderStatus: "draft", priorDeliveryCount: 2 }),
    false
  );
});

test("sumPriorDeliveryCoverage scopes to the supplier order", () => {
  const coverage = sumPriorDeliveryCoverage({
    restaurantId: DEMO_RESTAURANT_ID,
    supplierOrderId: "order-a",
    deliveries: [
      {
        id: "d1",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_order_id: "order-a",
        status: "partially_received",
        received_at: FIXED_NOW,
        notes: null,
        created_at: FIXED_NOW
      },
      {
        id: "d2",
        restaurant_id: DEMO_RESTAURANT_ID,
        supplier_order_id: "order-b",
        status: "received",
        received_at: FIXED_NOW,
        notes: null,
        created_at: FIXED_NOW
      }
    ],
    items: [
      {
        id: "i1",
        restaurant_id: DEMO_RESTAURANT_ID,
        delivery_id: "d1",
        inventory_item_id: "item-a",
        ordered_quantity: 10,
        received_quantity: 4,
        damaged_quantity: 0,
        missing_quantity: 1,
        canonical_unit: "each"
      },
      {
        id: "i2",
        restaurant_id: DEMO_RESTAURANT_ID,
        delivery_id: "d2",
        inventory_item_id: "item-a",
        ordered_quantity: 10,
        received_quantity: 10,
        damaged_quantity: 0,
        missing_quantity: 0,
        canonical_unit: "each"
      }
    ]
  });

  assert.equal(coverage.size, 1);
  assert.equal(coverage.get("item-a")!.priorReceivedQuantity, 4);
  assert.equal(coverage.get("item-a")!.priorMissingQuantity, 1);
});
