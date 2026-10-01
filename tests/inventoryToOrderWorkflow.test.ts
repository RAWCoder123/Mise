import assert from "node:assert/strict";
import test from "node:test";

import { createInitialDemoState, DEMO_RESTAURANT_ID } from "../services/demoData";
import {
  createPreparedAction,
  markApproved,
  markExecuted,
  measureOutcome,
  miseActionIdempotencyKey
} from "../services/domain/miseActions";
import { buildOperatingBrief } from "../services/domain/operatingBrief";
import {
  buildDeliveryLinesFromOrderRecommendations,
  deliveryClientIdForOrder
} from "../services/domain/supplierDelivery";
import { normalizeInventoryItem } from "../services/miseValidation";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";

test("inventory→order approval cards expose one-tap recommendation ids", () => {
  const state = createInitialDemoState("Toast", undefined, new Date("2026-08-02T15:00:00.000Z"));
  const restaurant = state.restaurants[0]!;
  const item = state.inventoryItems[0]!;
  const pending: PurchaseRecommendation = {
    id: "rec-pending-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    recommended_quantity: 12,
    unit: item.unit,
    reason: "Coverage is below reorder level.",
    urgency: "high",
    status: "pending",
    supplier_order_id: null,
    created_at: "2026-08-02T14:00:00.000Z"
  };

  const brief = buildOperatingBrief({
    restaurant,
    operatingDate: "2026-08-02",
    generatedAt: "2026-08-02T15:00:00.000Z",
    sales: state.posSales,
    inventoryItems: state.inventoryItems,
    recommendations: [pending],
    orders: state.supplierOrders,
    insights: state.insights,
    miseActions: [],
    demoLabeled: true
  });

  assert.equal(brief.needsApproval.length, 1);
  assert.equal(brief.needsApproval[0]!.recommendationId, pending.id);
  assert.equal(brief.needsApproval[0]!.actionId, null);
});

test("awaiting send_supplier_order on draft orders surfaces decide_mise_action cards", () => {
  const state = createInitialDemoState("Toast", undefined, new Date("2026-08-02T15:00:00.000Z"));
  const restaurant = state.restaurants[0]!;
  const draft =
    state.supplierOrders.find((order) => order.status === "draft") ??
    ({
      id: "order-draft-1",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_id: state.suppliers[0]!.id,
      supplier_name: "Demo Supplier",
      message_locale: "en" as const,
      order_message: "Order draft",
      operator_note: null,
      status: "draft",
      delivery_date: "2026-08-03",
      created_at: "2026-08-02T12:00:00.000Z"
    } satisfies SupplierOrder);

  const action = createPreparedAction({
    restaurantId: DEMO_RESTAURANT_ID,
    actionType: "send_supplier_order",
    idempotencyKey: miseActionIdempotencyKey(DEMO_RESTAURANT_ID, "send_supplier_order", draft.id),
    expectedImpact: {
      supplierId: draft.supplier_id,
      supplierName: draft.supplier_name,
      orderId: draft.id
    },
    now: draft.created_at
  });
  assert.equal(action.status, "waiting_for_approval");

  const brief = buildOperatingBrief({
    restaurant,
    operatingDate: "2026-08-02",
    generatedAt: "2026-08-02T15:00:00.000Z",
    sales: state.posSales,
    inventoryItems: state.inventoryItems,
    recommendations: [],
    orders: [draft],
    insights: state.insights,
    miseActions: [action],
    demoLabeled: true
  });

  const card = brief.needsApproval.find((entry) => entry.actionId === action.id);
  assert.ok(card);
  assert.equal(card.recommendationId, null);
  assert.match(card.title, /Approve send/i);
});

test("delivery lines + outcome complete the inventory→order→receive path", () => {
  const state = createInitialDemoState("Toast", undefined, new Date("2026-08-02T15:00:00.000Z"));
  const item = normalizeInventoryItem(state.inventoryItems[0]!);
  const order: SupplierOrder = {
    id: "order-sent-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    message_locale: "en" as const,
    order_message: `${item.item_name} - 10 ${item.unit}`,
    operator_note: null,
    status: "sent",
    delivery_date: "2026-08-02",
    created_at: "2026-08-01T12:00:00.000Z"
  };
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

  const built = buildDeliveryLinesFromOrderRecommendations({
    order,
    recommendations: [recommendation],
    inventoryItems: [item],
    requireVerifiedCanonicalUnit: false
  });
  assert.ok(built.lines.length >= 1);
  assert.equal(built.lines[0]!.inventoryItemId, item.id);

  const receivedAt = "2026-08-02T16:00:00.000Z";
  const clientDeliveryId = deliveryClientIdForOrder(order.id, receivedAt);
  assert.match(clientDeliveryId, new RegExp(order.id));

  let action = createPreparedAction({
    restaurantId: DEMO_RESTAURANT_ID,
    actionType: "send_supplier_order",
    idempotencyKey: miseActionIdempotencyKey(DEMO_RESTAURANT_ID, "send_supplier_order", order.id),
    expectedImpact: {
      supplierId: order.supplier_id,
      supplierName: order.supplier_name,
      orderId: order.id
    },
    now: order.created_at
  });
  action = markApproved(action, "demo-user", receivedAt);
  action = markExecuted(action, { deliveryId: "delivery-1", status: "received" }, receivedAt);
  const outcome = measureOutcome({
    restaurantId: DEMO_RESTAURANT_ID,
    actionId: action.id,
    expectedResult: { deliveryStatus: "received" },
    actualResult: {
      deliveryStatus: "received",
      deliveryId: "delivery-1",
      lineCount: built.lines.length
    },
    measuredAt: receivedAt,
    lesson: "The supplier order was received as expected."
  });

  assert.equal(action.status, "executed");
  assert.equal(outcome.actionId, action.id);
  assert.equal(outcome.actualResult.deliveryStatus, "received");
  assert.deepEqual(outcome.variance, {});
});
