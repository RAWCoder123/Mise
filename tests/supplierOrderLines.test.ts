import assert from "node:assert/strict";
import test from "node:test";

import {
  approveRecommendationInDemoState,
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  undoRecommendationInDemoState
} from "../services/demoData";
import {
  buildSupplierOrderLineSnapshots,
  replaceSupplierOrderLinesForOrder
} from "../services/domain/supplierOrderLines";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";

const FIXED_NOW = new Date("2026-08-27T02:00:00.000Z");

test("buildSupplierOrderLineSnapshots freezes approved recommendation quantities", () => {
  const order: SupplierOrder = {
    id: "order-1",
    restaurant_id: DEMO_RESTAURANT_ID,
    supplier_id: "supplier-1",
    supplier_name: "Local Produce Co.",
    order_message: "draft",
    operator_note: null,
    status: "draft",
    delivery_date: "2026-08-28",
    created_at: FIXED_NOW.toISOString()
  };
  const recommendations: PurchaseRecommendation[] = [
    {
      id: "rec-b",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: "item-lettuce",
      item_name: "Lettuce",
      supplier_id: "supplier-1",
      supplier_name: "Local Produce Co.",
      recommended_quantity: 23,
      unit: "heads",
      reason: "par",
      urgency: "medium",
      status: "approved",
      supplier_order_id: "order-1",
      created_at: FIXED_NOW.toISOString()
    },
    {
      id: "rec-a",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: "item-tomato",
      item_name: "Tomatoes",
      supplier_id: "supplier-1",
      supplier_name: "Local Produce Co.",
      recommended_quantity: 20,
      unit: "lbs",
      reason: "par",
      urgency: "medium",
      status: "approved",
      supplier_order_id: "order-1",
      created_at: FIXED_NOW.toISOString()
    },
    {
      id: "rec-pending",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: "item-onion",
      item_name: "Onions",
      supplier_id: "supplier-1",
      supplier_name: "Local Produce Co.",
      recommended_quantity: 10,
      unit: "lbs",
      reason: "par",
      urgency: "low",
      status: "pending",
      supplier_order_id: null,
      created_at: FIXED_NOW.toISOString()
    }
  ];

  const lines = buildSupplierOrderLineSnapshots({
    order,
    recommendations,
    inventoryItems: [
      {
        id: "item-lettuce",
        restaurant_id: DEMO_RESTAURANT_ID,
        item_name: "Lettuce",
        category: "Produce",
        unit: "heads",
        current_quantity: 4,
        par_level: 20,
        reorder_threshold: 8,
        estimated_unit_cost: 2.5,
        supplier_id: "supplier-1",
        supplier_name: "Local Produce Co.",
        last_updated: FIXED_NOW.toISOString(),
        canonical_unit: "each",
        canonical_quantity_per_unit: 1,
        canonical_unit_verification_status: "verified"
      },
      {
        id: "item-tomato",
        restaurant_id: DEMO_RESTAURANT_ID,
        item_name: "Tomatoes",
        category: "Produce",
        unit: "lbs",
        current_quantity: 5,
        par_level: 20,
        reorder_threshold: 8,
        estimated_unit_cost: 1.75,
        supplier_id: "supplier-1",
        supplier_name: "Local Produce Co.",
        last_updated: FIXED_NOW.toISOString(),
        canonical_unit: "g",
        canonical_quantity_per_unit: 453.592,
        canonical_unit_verification_status: "verified"
      }
    ],
    nowIso: FIXED_NOW.toISOString()
  });

  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.map((line) => line.item_name),
    ["Lettuce", "Tomatoes"]
  );
  assert.equal(lines[0]?.ordered_quantity, 23);
  assert.equal(lines[0]?.canonical_unit, "each");
  assert.equal(lines[0]?.estimated_unit_cost, 2.5);
  assert.equal(lines[1]?.purchase_recommendation_id, "rec-a");
});

test("demo approve dual-writes durable supplier order lines", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  state.purchaseRecommendations = state.purchaseRecommendations.map((recommendation) =>
    recommendation.status === "approved"
      ? { ...recommendation, status: "pending", supplier_order_id: null }
      : recommendation
  );
  state.supplierOrders = [];
  state.supplierOrderLines = [];

  const pending = state.purchaseRecommendations.find(
    (recommendation) => recommendation.status === "pending"
  );
  assert.ok(pending);

  const result = approveRecommendationInDemoState(
    state,
    DEMO_RESTAURANT_ID,
    pending.id,
    pending.recommended_quantity
  );
  assert.equal(result.outcome, "applied");
  assert.ok(result.order);
  const lines = state.supplierOrderLines.filter(
    (line) => line.supplier_order_id === result.order!.id
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.inventory_item_id, pending.inventory_item_id);
  assert.equal(lines[0]?.ordered_quantity, pending.recommended_quantity);

  undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id);
  assert.equal(
    state.supplierOrderLines.filter((line) => line.supplier_order_id === result.order!.id)
      .length,
    0
  );
});

test("replaceSupplierOrderLinesForOrder swaps only the target order", () => {
  const existing = [
    {
      id: "keep",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_order_id: "order-a",
      inventory_item_id: "item-1",
      purchase_recommendation_id: "rec-1",
      item_name: "Keep",
      ordered_quantity: 1,
      unit: "each",
      canonical_unit: "each" as const,
      estimated_unit_cost: null,
      line_position: 0,
      created_at: FIXED_NOW.toISOString(),
      updated_at: FIXED_NOW.toISOString()
    },
    {
      id: "replace",
      restaurant_id: DEMO_RESTAURANT_ID,
      supplier_order_id: "order-b",
      inventory_item_id: "item-2",
      purchase_recommendation_id: "rec-2",
      item_name: "Old",
      ordered_quantity: 2,
      unit: "each",
      canonical_unit: "each" as const,
      estimated_unit_cost: null,
      line_position: 0,
      created_at: FIXED_NOW.toISOString(),
      updated_at: FIXED_NOW.toISOString()
    }
  ];
  const next = [
    {
      ...existing[1]!,
      id: "new",
      item_name: "New",
      ordered_quantity: 5
    }
  ];
  const replaced = replaceSupplierOrderLinesForOrder(
    existing,
    DEMO_RESTAURANT_ID,
    "order-b",
    next
  );
  assert.equal(replaced.length, 2);
  assert.equal(replaced.find((line) => line.supplier_order_id === "order-a")?.item_name, "Keep");
  assert.equal(replaced.find((line) => line.supplier_order_id === "order-b")?.item_name, "New");
});
