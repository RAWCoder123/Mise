import assert from "node:assert/strict";
import test from "node:test";

import {
  approveRecommendationInDemoState,
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  dismissRecommendationInDemoState,
  markSupplierOrderSentInDemoState,
  rebuildPurchaseRecommendations,
  repairDemoState,
  undoRecommendationInDemoState,
  type DemoState,
  type StoredDemoState
} from "../services/demoData";
import type { PurchaseRecommendation, SupplierOrder } from "../types/mise";

const FIXED_NOW = new Date("2026-07-15T16:00:00.000Z");

function emptyWorkflowState(): DemoState {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  state.purchaseRecommendations = [];
  state.supplierOrders = [];
  return state;
}

function recommendation(
  id: string,
  overrides: Partial<PurchaseRecommendation> = {}
): PurchaseRecommendation {
  return {
    id,
    restaurant_id: DEMO_RESTAURANT_ID,
    inventory_item_id: `item_${id}`,
    item_name: `Item ${id}`,
    supplier_name: "Neighborhood Produce",
    recommended_quantity: 5,
    unit: "cases",
    reason: "Projected below par.",
    urgency: "medium",
    status: "pending",
    supplier_order_id: null,
    created_at: FIXED_NOW.toISOString(),
    ...overrides
  };
}

test("approving recommendations reuses one supplier draft and is replay-safe", () => {
  const state = emptyWorkflowState();
  const zucchini = recommendation("zucchini", { item_name: "Zucchini" });
  const apples = recommendation("apples", { item_name: "Apples" });
  state.purchaseRecommendations.push(zucchini, apples);

  const first = approveRecommendationInDemoState(
    state,
    DEMO_RESTAURANT_ID,
    zucchini.id,
    7.5
  );

  assert.equal(first.outcome, "applied");
  assert.equal(first.previousStatus, "pending");
  assert.equal(zucchini.recommended_quantity, 7.5);
  assert.equal(zucchini.status, "approved");
  assert.ok(first.order);
  assert.equal(state.supplierOrders.length, 1);

  first.order.operator_note = "Use the side entrance.";
  const second = approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, apples.id);

  assert.equal(second.order?.id, first.order.id);
  assert.equal(state.supplierOrders.length, 1);
  assert.ok(first.order.order_message.indexOf("Apples") < first.order.order_message.indexOf("Zucchini"));
  assert.match(first.order.order_message, /Notes:\nUse the side entrance\./);

  const replay = approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, apples.id, 99);
  assert.equal(replay.outcome, "already_applied");
  assert.equal(apples.recommended_quantity, 5);
  assert.equal(state.supplierOrders.length, 1);
  assert.equal(first.order.order_message.match(/Apples/g)?.length, 1);
});

test("refreshed pending evidence stays suppressed after approval until a newer count", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  state.purchaseRecommendations = [];
  state.supplierOrders = [];
  rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID);
  const pending = state.purchaseRecommendations.find(
    (recommendation) => recommendation.status === "pending"
  );
  assert.ok(pending);
  const item = state.inventoryItems.find(
    (inventoryItem) => inventoryItem.id === pending.inventory_item_id
  );
  assert.ok(item);

  pending.created_at = "2026-07-15T09:00:00.000Z";
  item.last_updated = "2026-07-16T09:00:00.000Z";
  item.last_counted_at = "2026-07-16T09:00:00.000Z";
  rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID);

  const refreshed = state.purchaseRecommendations.find(
    (recommendation) => recommendation.id === pending.id
  );
  assert.ok(refreshed);
  assert.equal(refreshed.status, "pending");
  assert.ok(refreshed.created_at.localeCompare(item.last_counted_at!) >= 0);

  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, refreshed.id);
  rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID);
  assert.equal(
    state.purchaseRecommendations.some(
      (recommendation) =>
        recommendation.inventory_item_id === item.id &&
        recommendation.status === "pending"
    ),
    false
  );

  item.last_updated = new Date(Date.now() + 60_000).toISOString();
  item.last_counted_at = item.last_updated;
  rebuildPurchaseRecommendations(state, DEMO_RESTAURANT_ID);
  const nextPending = state.purchaseRecommendations.find(
    (recommendation) =>
      recommendation.inventory_item_id === item.id &&
      recommendation.status === "pending"
  );
  assert.ok(nextPending);
  assert.notEqual(nextPending.id, refreshed.id);
});

test("recommendation decisions reject invalid quantities, tenants, and handled states", () => {
  const state = emptyWorkflowState();
  const pending = recommendation("pending");
  const dismissed = recommendation("dismissed", { status: "dismissed" });
  const ordered = recommendation("ordered", { status: "ordered" });
  state.purchaseRecommendations.push(pending, dismissed, ordered);

  for (const invalid of [0, Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
    assert.throws(
      () => approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id, invalid),
      /valid order quantity/
    );
  }
  assert.equal(pending.status, "pending");
  assert.equal(state.supplierOrders.length, 0);

  assert.throws(
    () => approveRecommendationInDemoState(state, "another_restaurant", pending.id),
    /Recommendation not found/
  );
  assert.throws(
    () => approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, dismissed.id),
    /Already handled/
  );
  assert.throws(
    () => dismissRecommendationInDemoState(state, DEMO_RESTAURANT_ID, ordered.id),
    /Already handled/
  );
  assert.throws(
    () => undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, ordered.id),
    /cannot be undone/
  );
});

test("dismiss and undo preserve the idempotent recommendation lifecycle", () => {
  const state = emptyWorkflowState();
  const pending = recommendation("decision");
  state.purchaseRecommendations.push(pending);

  const dismissed = dismissRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id);
  assert.equal(dismissed.outcome, "applied");
  assert.equal(dismissed.previousStatus, "pending");
  assert.equal(pending.status, "dismissed");
  assert.equal(pending.supplier_order_id, null);

  const dismissReplay = dismissRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id);
  assert.equal(dismissReplay.outcome, "already_applied");

  const restored = undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id);
  assert.equal(restored.outcome, "applied");
  assert.equal(restored.previousStatus, "dismissed");
  assert.equal(pending.status, "pending");

  const undoReplay = undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id);
  assert.equal(undoReplay.outcome, "already_applied");

  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id);
  assert.throws(
    () => dismissRecommendationInDemoState(state, DEMO_RESTAURANT_ID, pending.id),
    /Already handled/
  );
});

test("undoing approved items rebuilds a shared draft and removes it when empty", () => {
  const state = emptyWorkflowState();
  const onions = recommendation("onions", { item_name: "Onions" });
  const peppers = recommendation("peppers", { item_name: "Peppers" });
  state.purchaseRecommendations.push(onions, peppers);

  const firstApproval = approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, onions.id);
  assert.ok(firstApproval.order);
  firstApproval.order.operator_note = "Call on arrival.";
  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, peppers.id);

  const firstUndo = undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, onions.id);
  assert.equal(firstUndo.outcome, "applied");
  assert.equal(onions.status, "pending");
  assert.equal(onions.supplier_order_id, null);
  assert.equal(state.supplierOrders.length, 1);
  assert.doesNotMatch(firstApproval.order.order_message, /Onions/);
  assert.match(firstApproval.order.order_message, /Peppers/);
  assert.match(firstApproval.order.order_message, /Call on arrival/);

  undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, peppers.id);
  assert.equal(peppers.status, "pending");
  assert.equal(state.supplierOrders.length, 0);
});

test("undo refuses to replace a newer pending recommendation", () => {
  const state = emptyWorkflowState();
  const approved = recommendation("approved", { inventory_item_id: "shared_item" });
  state.purchaseRecommendations.push(approved);
  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, approved.id);

  const newer = recommendation("newer", {
    inventory_item_id: approved.inventory_item_id,
    created_at: "2026-07-16T16:00:00.000Z"
  });
  state.purchaseRecommendations.push(newer);

  assert.throws(
    () => undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, approved.id),
    /newer recommendation is already pending/
  );
  assert.equal(approved.status, "approved");
  assert.ok(approved.supplier_order_id);
});

test("marking a supplier draft sent advances only approved linked recommendations", () => {
  const state = emptyWorkflowState();
  const carrots = recommendation("carrots", { item_name: "Carrots" });
  const celery = recommendation("celery", { item_name: "Celery" });
  state.purchaseRecommendations.push(carrots, celery);
  const approval = approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, carrots.id);
  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, celery.id);
  assert.ok(approval.order);

  const dismissedLinked = recommendation("dismissed_linked", {
    status: "dismissed",
    supplier_order_id: approval.order.id
  });
  state.purchaseRecommendations.push(dismissedLinked);

  const sent = markSupplierOrderSentInDemoState(state, DEMO_RESTAURANT_ID, approval.order.id);
  assert.equal(sent.outcome, "applied");
  assert.equal(sent.order.status, "sent");
  assert.deepEqual(sent.orderedRecommendations.map((entry) => entry.id), [carrots.id, celery.id]);
  assert.equal(carrots.status, "ordered");
  assert.equal(celery.status, "ordered");
  assert.equal(dismissedLinked.status, "dismissed");

  const replay = markSupplierOrderSentInDemoState(state, DEMO_RESTAURANT_ID, approval.order.id);
  assert.equal(replay.outcome, "already_applied");
  assert.deepEqual(replay.orderedRecommendations.map((entry) => entry.id), [carrots.id, celery.id]);
  assert.throws(
    () => markSupplierOrderSentInDemoState(state, "another_restaurant", approval.order!.id),
    /Order draft not found/
  );
});

test("demo-state repair retains history, deduplicates pending rows, and restores links", () => {
  const seed = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const source = seed.purchaseRecommendations[0]!;
  const sourceOrder = seed.supplierOrders[0]!;
  const { operator_note: _legacyNote, ...orderWithoutNote } = sourceOrder;
  const legacyOrder = orderWithoutNote as SupplierOrder;

  const raw: StoredDemoState = {
    ...seed,
    schema_version: 1,
    supplierOrders: [legacyOrder],
    purchaseRecommendations: [
      {
        ...source,
        id: "legacy_rec",
        status: "approved",
        supplier_order_id: null,
        created_at: "2026-07-10T10:00:00.000Z"
      },
      {
        ...source,
        id: "legacy_rec",
        status: "dismissed",
        supplier_order_id: sourceOrder.id,
        created_at: "2026-07-11T10:00:00.000Z"
      },
      {
        ...source,
        id: "legacy_rec",
        status: "pending",
        supplier_order_id: sourceOrder.id,
        created_at: "2026-07-12T10:00:00.000Z"
      },
      {
        ...source,
        id: "legacy_rec",
        status: "pending",
        supplier_order_id: sourceOrder.id,
        created_at: "2026-07-13T10:00:00.000Z"
      }
    ]
  };

  const repaired = repairDemoState(raw);
  const approved = repaired.state.purchaseRecommendations.find((entry) => entry.status === "approved");
  const dismissed = repaired.state.purchaseRecommendations.find((entry) => entry.status === "dismissed");
  const pending = repaired.state.purchaseRecommendations.find((entry) => entry.status === "pending");

  assert.equal(repaired.migrated, true);
  assert.equal(repaired.state.schema_version, 10);
  assert.equal(repaired.state.purchaseRecommendations.length, 3);
  assert.equal(new Set(repaired.state.purchaseRecommendations.map((entry) => entry.id)).size, 3);
  assert.deepEqual(
    repaired.state.purchaseRecommendations.map((entry) => entry.id),
    ["legacy_rec", "legacy_rec_v2_1", "legacy_rec_v2_2"]
  );
  assert.equal(pending?.created_at, "2026-07-13T10:00:00.000Z");
  assert.equal(approved?.supplier_order_id, sourceOrder.id);
  assert.equal(dismissed?.supplier_order_id, null);
  assert.equal(pending?.supplier_order_id, null);
  assert.equal(repaired.state.supplierOrders[0]?.operator_note, null);
});

test("demo-state repair links histories only to compatible tenant order lanes", () => {
  const seed = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const source = seed.purchaseRecommendations[0]!;
  const sourceOrder = seed.supplierOrders[0]!;
  const orders: SupplierOrder[] = [
    { ...sourceOrder, id: "draft_old", created_at: "2026-07-10T10:00:00.000Z" },
    { ...sourceOrder, id: "draft_new", created_at: "2026-07-12T10:00:00.000Z" },
    {
      ...sourceOrder,
      id: "sent_new",
      status: "sent",
      created_at: "2026-07-13T10:00:00.000Z"
    },
    {
      ...sourceOrder,
      id: "other_tenant",
      restaurant_id: "another_restaurant",
      created_at: "2026-07-14T10:00:00.000Z"
    }
  ];
  const raw: StoredDemoState = {
    ...seed,
    supplierOrders: orders,
    purchaseRecommendations: [
      {
        ...source,
        id: "approved_history",
        status: "approved",
        supplier_order_id: "missing_order"
      },
      {
        ...source,
        id: "ordered_history",
        status: "ordered",
        supplier_order_id: "missing_order"
      }
    ]
  };

  const repaired = repairDemoState(raw);
  assert.equal(
    repaired.state.purchaseRecommendations.find((entry) => entry.id === "approved_history")?.supplier_order_id,
    "draft_new"
  );
  assert.equal(
    repaired.state.purchaseRecommendations.find((entry) => entry.id === "ordered_history")?.supplier_order_id,
    "sent_new"
  );
});

test("already-current demo state does not report a migration", () => {
  const seed = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const repaired = repairDemoState(seed);

  assert.equal(repaired.migrated, false);
  assert.deepEqual(
    repaired.state.purchaseRecommendations.map((entry) => entry.id),
    seed.purchaseRecommendations.map((entry) => entry.id)
  );
  assert.deepEqual(
    repaired.state.purchaseRecommendations.map((entry) => entry.supplier_order_id),
    seed.purchaseRecommendations.map((entry) => entry.supplier_order_id)
  );
});
