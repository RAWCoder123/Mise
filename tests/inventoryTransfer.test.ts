import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MAIN_STORAGE_LOCATION_NAME,
  canManageStorageLocations,
  canTransferInventory,
  planInventoryTransfer,
  planLocationBalanceReconcile,
  planStorageLocationCreate,
  reconcileLocationBalancesForDisplay
} from "../services/domain/inventoryTransfer";
import {
  operatingLimits,
  requireInventoryTransferQuantity,
  requireStorageLocationName
} from "../services/miseValidation";
import { canTransferInventory as canTransferInventoryForRestaurant } from "../services/tenantAccess";
import type { RestaurantMembership } from "../types/mise";

test("planInventoryTransfer moves quantity between locations without changing on-hand total", () => {
  const planned = planInventoryTransfer({
    onHandQuantity: 20,
    balances: [
      { storageLocationId: "loc_main", quantity: 15 },
      { storageLocationId: "loc_line", quantity: 5 }
    ],
    fromStorageLocationId: "loc_main",
    toStorageLocationId: "loc_line",
    quantity: 4,
    note: "  Prep for dinner  "
  });

  assert.equal(planned.onHandQuantity, 20);
  assert.equal(planned.quantityMoved, 4);
  assert.equal(planned.reason, "transfer");
  assert.equal(planned.sourceWorkflow, "transfer_inventory");
  assert.equal(planned.metadata.note, "Prep for dinner");
  assert.equal(planned.metadata.from_storage_location_id, "loc_main");
  assert.equal(planned.metadata.to_storage_location_id, "loc_line");
  assert.deepEqual(planned.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 15, quantityAfter: 11 },
    { storageLocationId: "loc_line", quantityBefore: 5, quantityAfter: 9 }
  ]);
});

test("planInventoryTransfer seeds empty balances onto a main location before moving stock", () => {
  const planned = planInventoryTransfer({
    onHandQuantity: 12,
    balances: [],
    fromStorageLocationId: "loc_main",
    toStorageLocationId: "loc_walkin",
    quantity: 3,
    mainStorageLocationId: "loc_main"
  });

  assert.equal(planned.seededMainQuantity, 12);
  assert.deepEqual(planned.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 12, quantityAfter: 9 },
    { storageLocationId: "loc_walkin", quantityBefore: 0, quantityAfter: 3 }
  ]);
});

test("planInventoryTransfer rejects same-location, overdraw, and invalid quantities", () => {
  assert.throws(
    () =>
      planInventoryTransfer({
        onHandQuantity: 10,
        balances: [{ storageLocationId: "loc_main", quantity: 10 }],
        fromStorageLocationId: "loc_main",
        toStorageLocationId: "loc_main",
        quantity: 1
      }),
    /different storage locations/i
  );
  assert.throws(
    () =>
      planInventoryTransfer({
        onHandQuantity: 10,
        balances: [{ storageLocationId: "loc_main", quantity: 2 }],
        fromStorageLocationId: "loc_main",
        toStorageLocationId: "loc_line",
        quantity: 5
      }),
    /insufficient/i
  );
  assert.throws(
    () =>
      planInventoryTransfer({
        onHandQuantity: 10,
        balances: [{ storageLocationId: "loc_main", quantity: 10 }],
        fromStorageLocationId: "loc_main",
        toStorageLocationId: "loc_line",
        quantity: 0
      }),
    /greater than zero/i
  );
});

test("planStorageLocationCreate normalizes names and reserves Main", () => {
  const planned = planStorageLocationCreate({ name: "  Walk-in Cooler  " });
  assert.equal(planned.name, "Walk-in Cooler");
  assert.equal(MAIN_STORAGE_LOCATION_NAME, "Main");
  assert.throws(() => planStorageLocationCreate({ name: "main" }), /reserved/i);
  assert.throws(() => planStorageLocationCreate({ name: "  " }), /required/i);
});

test("reconcileLocationBalancesForDisplay exposes unallocated stock when balances lag on-hand", () => {
  const view = reconcileLocationBalancesForDisplay({
    onHandQuantity: 20,
    balances: [
      { storageLocationId: "loc_main", name: "Main", quantity: 12 },
      { storageLocationId: "loc_line", name: "Line", quantity: 5 }
    ]
  });
  assert.equal(view.allocatedQuantity, 17);
  assert.equal(view.unallocatedQuantity, 3);
  assert.equal(view.matchesOnHand, false);
});

test("planLocationBalanceReconcile seeds empty balances onto Main", () => {
  const planned = planLocationBalanceReconcile({
    onHandQuantity: 18,
    balances: [],
    mainStorageLocationId: "loc_main"
  });
  assert.equal(planned.changed, true);
  assert.equal(planned.seededMain, true);
  assert.deepEqual(planned.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 0, quantityAfter: 18 }
  ]);
});

test("planLocationBalanceReconcile adds on-hand increases to Main", () => {
  const planned = planLocationBalanceReconcile({
    onHandQuantity: 25,
    balances: [
      { storageLocationId: "loc_main", quantity: 10 },
      { storageLocationId: "loc_line", quantity: 5 }
    ],
    mainStorageLocationId: "loc_main"
  });
  assert.equal(planned.changed, true);
  assert.equal(planned.delta, 10);
  assert.deepEqual(planned.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 10, quantityAfter: 20 }
  ]);
});

test("planLocationBalanceReconcile reduces Main first, then other stations", () => {
  const planned = planLocationBalanceReconcile({
    onHandQuantity: 4,
    balances: [
      { storageLocationId: "loc_main", quantity: 3 },
      { storageLocationId: "loc_line", quantity: 5 },
      { storageLocationId: "loc_walkin", quantity: 2 }
    ],
    mainStorageLocationId: "loc_main"
  });
  assert.equal(planned.changed, true);
  assert.equal(planned.delta, -6);
  assert.deepEqual(planned.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 3, quantityAfter: 0 },
    { storageLocationId: "loc_line", quantityBefore: 5, quantityAfter: 2 }
  ]);
  const afterById = new Map(
    [
      ...planned.balanceUpdates,
      { storageLocationId: "loc_walkin", quantityBefore: 2, quantityAfter: 2 }
    ].map((row) => [row.storageLocationId, row.quantityAfter])
  );
  assert.equal([...afterById.values()].reduce((sum, qty) => sum + qty, 0), 4);
});

test("planLocationBalanceReconcile is a no-op when balances already match on-hand", () => {
  const planned = planLocationBalanceReconcile({
    onHandQuantity: 15,
    balances: [
      { storageLocationId: "loc_main", quantity: 10 },
      { storageLocationId: "loc_line", quantity: 5 }
    ],
    mainStorageLocationId: "loc_main"
  });
  assert.equal(planned.changed, false);
  assert.equal(planned.balanceUpdates.length, 0);
});

test("transfer quantity and location name validators bound operator input", () => {
  assert.equal(requireInventoryTransferQuantity(2.5), 2.5);
  assert.throws(() => requireInventoryTransferQuantity(0), /greater than zero/i);
  assert.throws(
    () => requireInventoryTransferQuantity(operatingLimits.inventoryQuantity + 1),
    /no more than/i
  );
  assert.equal(requireStorageLocationName(" Prep "), "Prep");
  assert.throws(() => requireStorageLocationName("x".repeat(81)), /80/i);
});

test("staff may transfer inventory while storage location create stays manager+", () => {
  assert.equal(canTransferInventory("staff"), true);
  assert.equal(canTransferInventory("manager"), true);
  assert.equal(canTransferInventory(null), false);
  assert.equal(canManageStorageLocations("staff"), false);
  assert.equal(canManageStorageLocations("manager"), true);

  const staffMembership: RestaurantMembership[] = [
    {
      id: "membership_staff",
      restaurant_id: "restaurant_a",
      user_id: "user_staff",
      role: "staff",
      status: "active",
      created_at: "2026-07-31T00:00:00.000Z",
      updated_at: "2026-07-31T00:00:00.000Z"
    }
  ];
  assert.equal(canTransferInventoryForRestaurant(staffMembership, "restaurant_a"), true);
  assert.equal(canTransferInventoryForRestaurant(staffMembership, "restaurant_b"), false);
});

test("inventory detail surfaces transfer controls and localized copy", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260731163000_storage_locations_and_transfer.sql",
    "utf8"
  );
  const syncMigration = readFileSync(
    "supabase/migrations/20260731173000_sync_location_balances_on_quantity_writes.sql",
    "utf8"
  );
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const demoStorage = readFileSync("services/demo/storageLocations.ts", "utf8");

  assert.match(detail, /canTransferInventory/);
  assert.match(detail, /transferInventory/);
  assert.match(detail, /inventory\.detail\.transfer/);
  assert.match(catalog, /"inventory\.detail\.transferAction": "Transfer stock"/);
  assert.match(catalog, /"inventory\.detail\.transferAction": "Trasladar stock"/);
  assert.match(catalog, /"inventory\.detail\.transferAction": "调拨库存"/);
  assert.match(edge, /"transfer_inventory"/);
  assert.match(migration, /create table if not exists public\.storage_locations/i);
  assert.match(migration, /create table if not exists public\.inventory_location_balances/i);
  assert.match(migration, /service_transfer_inventory/i);
  assert.match(migration, /source_workflow,\s*[\s\S]*'transfer_inventory'/i);
  assert.match(syncMigration, /reconcile_inventory_location_balances_to_on_hand/i);
  assert.match(syncMigration, /inventory_items_reconcile_location_balances/i);
  assert.match(demoStorage, /reconcileDemoLocationBalancesToOnHand/);
  assert.match(repository, /reconcileDemoLocationBalancesToOnHand/);
});
