import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  repairDemoState,
  type DemoState,
  type StoredDemoState
} from "../services/demoData";
import {
  listDemoInventoryLocationBalances,
  reconcileDemoLocationBalancesToOnHand,
  transferDemoInventory
} from "../services/demo/storageLocations";
import {
  approveRecommendationInDemoState,
  dismissRecommendationInDemoState,
  markSupplierOrderSentInDemoState,
  undoRecommendationInDemoState
} from "../services/domain/miseDomain";
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
    original_recommended_quantity: null,
    dismiss_reason: null,
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
  assert.equal(zucchini.original_recommended_quantity, 5);
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
  assert.equal(apples.original_recommended_quantity, 5);
  assert.equal(apples.recommended_quantity, 5);
  assert.equal(state.supplierOrders.length, 1);
  assert.equal(first.order.order_message.match(/Apples/g)?.length, 1);
});

test("approval preserves original quantity and undo restores it after an edit", () => {
  const state = emptyWorkflowState();
  const carrots = recommendation("carrots_edit", { recommended_quantity: 12 });
  state.purchaseRecommendations.push(carrots);

  approveRecommendationInDemoState(state, DEMO_RESTAURANT_ID, carrots.id, 9);
  assert.equal(carrots.original_recommended_quantity, 12);
  assert.equal(carrots.recommended_quantity, 9);

  const restored = undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, carrots.id);
  assert.equal(restored.outcome, "applied");
  assert.equal(carrots.status, "pending");
  assert.equal(carrots.recommended_quantity, 12);
  assert.equal(carrots.original_recommended_quantity, null);
});

test("dismiss accepts an optional reason and clears it on undo", () => {
  const state = emptyWorkflowState();
  const peppers = recommendation("peppers_dismiss");
  state.purchaseRecommendations.push(peppers);

  assert.throws(
    () => dismissRecommendationInDemoState(state, DEMO_RESTAURANT_ID, peppers.id, "x".repeat(241)),
    /outside supported limits/
  );
  assert.equal(peppers.status, "pending");

  const dismissed = dismissRecommendationInDemoState(
    state,
    DEMO_RESTAURANT_ID,
    peppers.id,
    "  Already covered by walk-in  "
  );
  assert.equal(dismissed.outcome, "applied");
  assert.equal(peppers.status, "dismissed");
  assert.equal(peppers.dismiss_reason, "Already covered by walk-in");

  undoRecommendationInDemoState(state, DEMO_RESTAURANT_ID, peppers.id);
  assert.equal(peppers.status, "pending");
  assert.equal(peppers.dismiss_reason, null);
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
  assert.equal(repaired.state.schema_version, 8);
  assert.ok(Array.isArray(repaired.state.inventoryMovements));
  assert.ok(Array.isArray(repaired.state.inventoryCountSessions));
  assert.ok(Array.isArray(repaired.state.memberships));
  assert.ok(repaired.state.memberships.length >= 1);
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

test("demo seed includes a multi-role team roster", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  assert.equal(state.schema_version, 8);
  assert.equal(state.memberships.length, 3);
  assert.deepEqual(
    state.memberships.map((membership) => membership.role).sort(),
    ["manager", "owner", "staff"]
  );
  assert.equal(state.users.length, 3);
  assert.ok(state.users.every((user) => state.memberships.some((membership) => membership.user_id === user.id)));
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

test("demo inventory quantity changes append an auditable manager_correction movement", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const item = state.inventoryItems[0]!;
  const before = item.current_quantity;
  const after = before + 3;

  state.inventoryItems[0] = { ...item, current_quantity: after, last_updated: FIXED_NOW.toISOString() };
  state.inventoryMovements = [
    {
      id: "movement_1",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: item.id,
      actor_user_id: state.users[0]!.id,
      reason: "manager_correction",
      quantity_before: before,
      quantity_after: after,
      delta: after - before,
      source_workflow: "update_inventory",
      metadata: {
        par_level: item.par_level,
        reorder_threshold: item.reorder_threshold,
        note: "Cycle count fix"
      },
      created_at: FIXED_NOW.toISOString()
    },
    ...state.inventoryMovements
  ];

  assert.equal(state.inventoryMovements.length, 1);
  assert.equal(state.inventoryMovements[0]?.quantity_before, before);
  assert.equal(state.inventoryMovements[0]?.quantity_after, after);
  assert.equal(state.inventoryMovements[0]?.reason, "manager_correction");
  assert.equal(state.inventoryMovements[0]?.source_workflow, "update_inventory");
  assert.equal(state.inventoryMovements[0]?.metadata.note, "Cycle count fix");
});

test("demo waste recording deducts on-hand stock with a waste ledger reason", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const item = state.inventoryItems[0]!;
  const before = item.current_quantity;
  const removed = Math.min(2, before);
  const after = before - removed;

  state.inventoryItems[0] = { ...item, current_quantity: after, last_updated: FIXED_NOW.toISOString() };
  state.inventoryMovements = [
    {
      id: "movement_waste_1",
      restaurant_id: DEMO_RESTAURANT_ID,
      inventory_item_id: item.id,
      actor_user_id: state.users[0]!.id,
      reason: "waste",
      quantity_before: before,
      quantity_after: after,
      delta: after - before,
      source_workflow: "record_waste",
      metadata: {
        quantity_removed_requested: removed,
        quantity_removed_applied: removed,
        floored: false,
        note: "Trim loss"
      },
      created_at: FIXED_NOW.toISOString()
    },
    ...state.inventoryMovements
  ];

  assert.equal(state.inventoryItems[0]?.current_quantity, after);
  assert.equal(state.inventoryMovements[0]?.reason, "waste");
  assert.equal(state.inventoryMovements[0]?.source_workflow, "record_waste");
  assert.equal(state.inventoryMovements[0]?.delta, -removed);
});

test("demo state seeds Main location balances and migrates older stores", () => {
  const seed = createInitialDemoState("Toast", undefined, FIXED_NOW);
  assert.equal(seed.schema_version, 8);
  assert.deepEqual(seed.inventoryCountSessions, []);
  assert.ok(seed.storageLocations.some((location) => location.name === "Main"));
  assert.ok(seed.storageLocations.some((location) => location.name === "Walk-in"));
  assert.equal(seed.inventoryLocationBalances.length, seed.inventoryItems.length);
  assert.equal(
    listDemoInventoryLocationBalances(seed, DEMO_RESTAURANT_ID).length,
    seed.inventoryLocationBalances.length
  );
  assert.ok(
    seed.inventoryItems.every((item) => {
      const sum = seed.inventoryLocationBalances
        .filter((balance) => balance.inventory_item_id === item.id)
        .reduce((total, row) => total + row.quantity, 0);
      return Math.abs(sum - item.current_quantity) < 1e-9;
    })
  );

  const { inventoryCountSessions: _ignored, schema_version: _version, ...legacy } = seed;
  const repaired = repairDemoState({
    ...legacy,
    schema_version: 4,
    inventoryLocationBalances: []
  });
  assert.equal(repaired.migrated, true);
  assert.equal(repaired.state.schema_version, 8);
  assert.ok(Array.isArray(repaired.state.inventoryCountSessions));
  assert.ok(Array.isArray(repaired.state.storageLocations));
  assert.ok(repaired.state.inventoryLocationBalances.length >= repaired.state.inventoryItems.length);
});

test("demo waste and receive keep Main location balances synced to on-hand", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const item = state.inventoryItems[0]!;
  const main = state.storageLocations.find((location) => location.name === "Main")!;
  const before = item.current_quantity;
  const mainBefore = state.inventoryLocationBalances.find(
    (row) => row.inventory_item_id === item.id && row.storage_location_id === main.id
  )!.quantity;

  item.current_quantity = before - 2;
  item.last_updated = FIXED_NOW.toISOString();
  reconcileDemoLocationBalancesToOnHand(state, DEMO_RESTAURANT_ID, item, FIXED_NOW.toISOString());

  assert.equal(
    state.inventoryLocationBalances.find(
      (row) => row.inventory_item_id === item.id && row.storage_location_id === main.id
    )?.quantity,
    mainBefore - 2
  );

  item.current_quantity = before + 5;
  reconcileDemoLocationBalancesToOnHand(state, DEMO_RESTAURANT_ID, item, FIXED_NOW.toISOString());
  assert.equal(
    state.inventoryLocationBalances.find(
      (row) => row.inventory_item_id === item.id && row.storage_location_id === main.id
    )?.quantity,
    mainBefore + 5
  );
});

test("demo inventory transfer moves location balances without changing restaurant on-hand", () => {
  const state = createInitialDemoState("Toast", undefined, FIXED_NOW);
  const item = state.inventoryItems[0]!;
  const main = state.storageLocations.find((location) => location.name === "Main")!;
  const walkIn = state.storageLocations.find((location) => location.name === "Walk-in")!;
  const onHandBefore = item.current_quantity;

  transferDemoInventory({
    state,
    restaurantId: DEMO_RESTAURANT_ID,
    item,
    fromStorageLocationId: main.id,
    toStorageLocationId: walkIn.id,
    quantity: 3,
    note: "Line prep",
    appendMovement: (movementInput) => {
      state.inventoryMovements = [
        {
          id: "movement_transfer_1",
          restaurant_id: movementInput.restaurantId,
          inventory_item_id: movementInput.itemId,
          actor_user_id: state.users[0]!.id,
          reason: movementInput.reason,
          quantity_before: movementInput.quantityBefore,
          quantity_after: movementInput.quantityAfter,
          delta: movementInput.quantityAfter - movementInput.quantityBefore,
          source_workflow: movementInput.sourceWorkflow,
          metadata: movementInput.metadata,
          created_at: FIXED_NOW.toISOString()
        },
        ...state.inventoryMovements
      ];
    }
  });

  assert.equal(item.current_quantity, onHandBefore);
  assert.equal(
    state.inventoryLocationBalances.find((row) => row.storage_location_id === main.id)?.quantity,
    onHandBefore - 3
  );
  assert.equal(
    state.inventoryLocationBalances.find((row) => row.storage_location_id === walkIn.id)?.quantity,
    3
  );
  assert.equal(state.inventoryMovements[0]?.reason, "transfer");
  assert.equal(state.inventoryMovements[0]?.source_workflow, "transfer_inventory");
  assert.equal(state.inventoryMovements[0]?.delta, 0);
});
