import assert from "node:assert/strict";
import test from "node:test";

import {
  approveRecommendationInDemoState,
  cancelSupplierOrderDraftInDemoState,
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  type DemoState
} from "../services/demoData";
import { createPreparedAction } from "../services/domain/miseActions";
import { demoSupplierIdForLegacyName } from "../services/demo/demoSupplierIdentity";
import type { PurchaseRecommendation } from "../types/mise";

const FIXED_NOW = new Date("2026-07-15T16:00:00.000Z");
const WORKFLOW_SUPPLIER_NAME = "Fresh Poultry Supply";
const WORKFLOW_SUPPLIER_ID = demoSupplierIdForLegacyName(
  DEMO_RESTAURANT_ID,
  WORKFLOW_SUPPLIER_NAME
);

function emptyWorkflowState(): DemoState {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  state.purchaseRecommendations = [];
  state.supplierOrders = [];
  return state;
}

function recommendation(
  state: DemoState,
  id: string,
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  const built: PurchaseRecommendation = {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: `item_${id}`,
    item_name: `Item ${id}`,
    supplier_id: WORKFLOW_SUPPLIER_ID,
    supplier_name: WORKFLOW_SUPPLIER_NAME,
    recommended_quantity: 5,
    unit: "cases",
    reason: "Projected below par.",
    urgency: "medium",
    status: "pending",
    supplier_order_id: null,
    created_at: FIXED_NOW.toISOString(),
    ...overrides
  };
  if (!state.inventoryItems.some((item) => item.id === built.inventory_item_id)) {
    const template = state.inventoryItems[0]!;
    state.inventoryItems.push({
      ...template,
      id: built.inventory_item_id,
      item_name: built.item_name,
      supplier_id: built.supplier_id,
      supplier_name: built.supplier_name
    });
  }
  return built;
}

test("canceling a draft restores every approved line and removes the order", () => {
  const state = emptyWorkflowState();
  const onions = recommendation(state, "onions", { item_name: "Onions" });
  const peppers = recommendation(state, "peppers", { item_name: "Peppers" });
  state.purchaseRecommendations.push(onions, peppers);

  const first = approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, onions.id);
  assert.ok(first.order);
  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, peppers.id);
  state.miseActions.push(
    createPreparedAction({
      restaurantId: DEMO_RESTAURANT_ID,
      actionType: "send_supplier_order",
      idempotencyKey: `send_supplier_order:${first.order!.id}`,
      expectedImpact: { orderId: first.order!.id },
      now: FIXED_NOW.toISOString()
    })
  );

  const cancelled = cancelSupplierOrderDraftInDemoState(
    state,
    DEMO_RESTAURANT_ID,
    first.order!.id
  );

  assert.equal(cancelled.restoredRecommendations.length, 2);
  assert.equal(onions.status, "pending");
  assert.equal(peppers.status, "pending");
  assert.equal(onions.supplier_order_id, null);
  assert.equal(peppers.supplier_order_id, null);
  assert.equal(state.supplierOrders.length, 0);
  assert.equal(
    state.miseActions.find(
      (action) => action.idempotencyKey === `send_supplier_order:${cancelled.orderId}`
    )?.status,
    "cancelled"
  );
});

test("cancel refuses sent orders and newer pending conflicts", () => {
  const state = emptyWorkflowState();
  const onions = recommendation(state, "onions", { item_name: "Onions" });
  state.purchaseRecommendations.push(onions);
  const approval = approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, onions.id);
  assert.ok(approval.order);

  approval.order!.status = "sent";
  assert.throws(
    () => cancelSupplierOrderDraftInDemoState(state, DEMO_RESTAURANT_ID, approval.order!.id),
    /Only draft supplier orders can be cancelled/
  );

  approval.order!.status = "draft";
  const newer = recommendation(state, "newer", {
    inventory_item_id: onions.inventory_item_id,
    item_name: onions.item_name,
    status: "pending",
    created_at: "2026-07-15T17:00:00.000Z"
  });
  state.purchaseRecommendations.push(newer);
  assert.throws(
    () => cancelSupplierOrderDraftInDemoState(state, DEMO_RESTAURANT_ID, approval.order!.id),
    /newer recommendation is already pending/
  );
  assert.equal(onions.status, "approved");
  assert.equal(state.supplierOrders.length, 1);
});

test("demo repository cancel restores the recommendation into pending review", async () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { window: { localStorage: Storage } }).window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
      clear: () => {
        values.clear();
      },
      key: (index) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      }
    }
  };

  const { createLocalDemoRepository } = await import("../services/repositories/demoRepository");
  const repository = createLocalDemoRepository();
  await repository.resetDemoData(null);
  const pending = (await repository.fetchPurchaseRecommendations(DEMO_RESTAURANT_ID, "pending"))[0];
  assert.ok(pending);

  const approved = await repository.approvePurchaseRecommendation(
    DEMO_RESTAURANT_ID,
    pending.id
  );
  assert.ok(approved.order);

  const cancelled = await repository.cancelSupplierOrderDraft(
    DEMO_RESTAURANT_ID,
    approved.order!.id
  );
  assert.equal(cancelled.outcome, "applied");
  assert.equal(cancelled.restoredCount, 1);
  assert.deepEqual(cancelled.restoredRecommendationIds, [pending.id]);

  const restored = await repository.fetchPurchaseRecommendations(DEMO_RESTAURANT_ID, "pending");
  assert.ok(restored.some((entry) => entry.id === pending.id && entry.status === "pending"));
  const orders = await repository.fetchSupplierOrders(DEMO_RESTAURANT_ID);
  assert.equal(orders.some((order) => order.id === approved.order!.id), false);
});
