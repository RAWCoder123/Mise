import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  planLocationBalanceReconcile,
  planReceiveLocationPutaway
} from "../services/domain/inventoryTransfer";
import {
  assertWasteStationAvailability,
  planInventoryWaste,
  planWasteLocationDeduction
} from "../services/domain/inventoryWaste";

test("planReceiveLocationPutaway moves Main increase onto the chosen station", () => {
  const planned = planReceiveLocationPutaway({
    mainStorageLocationId: "loc_main",
    storageLocationId: "loc_walkin",
    quantityReceived: 4,
    balances: [
      { storageLocationId: "loc_main", quantity: 10 },
      { storageLocationId: "loc_walkin", quantity: 2 }
    ]
  });

  assert.ok(planned);
  assert.equal(planned?.quantityReceived, 4);
  assert.deepEqual(planned?.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 10, quantityAfter: 6 },
    { storageLocationId: "loc_walkin", quantityBefore: 2, quantityAfter: 6 }
  ]);
});

test("planReceiveLocationPutaway is a no-op for Main or zero quantity", () => {
  assert.equal(
    planReceiveLocationPutaway({
      mainStorageLocationId: "loc_main",
      storageLocationId: "loc_main",
      quantityReceived: 3,
      balances: [{ storageLocationId: "loc_main", quantity: 3 }]
    }),
    null
  );
  assert.equal(
    planReceiveLocationPutaway({
      mainStorageLocationId: "loc_main",
      storageLocationId: "loc_walkin",
      quantityReceived: 0,
      balances: [{ storageLocationId: "loc_main", quantity: 3 }]
    }),
    null
  );
});

test("planReceiveLocationPutaway rejects overdrawing Main", () => {
  assert.throws(
    () =>
      planReceiveLocationPutaway({
        mainStorageLocationId: "loc_main",
        storageLocationId: "loc_walkin",
        quantityReceived: 5,
        balances: [{ storageLocationId: "loc_main", quantity: 2 }]
      }),
    /Insufficient Main/i
  );
});

test("planLocationBalanceReconcile seeds empty balances onto Main", () => {
  const planned = planLocationBalanceReconcile({
    onHandQuantity: 12,
    balances: [],
    mainStorageLocationId: "loc_main"
  });
  assert.equal(planned.seededMain, true);
  assert.deepEqual(planned.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 0, quantityAfter: 12 }
  ]);
});

test("assertWasteStationAvailability treats empty balances as Main-only", () => {
  assert.doesNotThrow(() =>
    assertWasteStationAvailability({
      onHandQuantity: 8,
      quantityRemovedApplied: 3,
      storageLocationId: "loc_main",
      mainStorageLocationId: "loc_main",
      balancesBefore: []
    })
  );
  assert.throws(
    () =>
      assertWasteStationAvailability({
        onHandQuantity: 8,
        quantityRemovedApplied: 3,
        storageLocationId: "loc_line",
        mainStorageLocationId: "loc_main",
        balancesBefore: []
      }),
    /Insufficient quantity/i
  );
});

test("planWasteLocationDeduction restores Main after attributing to another station", () => {
  const planned = planWasteLocationDeduction({
    mainStorageLocationId: "loc_main",
    storageLocationId: "loc_line",
    quantityRemoved: 2,
    mainQuantityBefore: 5,
    balancesAfterReconcile: [
      { storageLocationId: "loc_main", quantity: 3 },
      { storageLocationId: "loc_line", quantity: 4 }
    ]
  });
  assert.ok(planned);
  assert.equal(planned?.quantityMovedToMain, 2);
  assert.deepEqual(planned?.balanceUpdates, [
    { storageLocationId: "loc_main", quantityBefore: 3, quantityAfter: 5 },
    { storageLocationId: "loc_line", quantityBefore: 4, quantityAfter: 2 }
  ]);
});

test("planInventoryWaste records station metadata when provided", () => {
  const planned = planInventoryWaste({
    quantityBefore: 10,
    quantityRemoved: 3,
    note: " Trim  ",
    storageLocationId: "loc_line",
    storageLocationName: "Line"
  });
  assert.equal(planned.quantityRemovedApplied, 3);
  assert.equal(planned.metadata.storage_location_id, "loc_line");
  assert.equal(planned.metadata.storage_location_name, "Line");
  assert.equal(planned.metadata.note, "Trim");
});

test("receive putaway and waste station migration stays RPC-only", () => {
  const migration = readFileSync(
    "supabase/migrations/20260828010000_receive_putaway_waste_station_attribution.sql",
    "utf8"
  );
  assert.match(migration, /private\.apply_inventory_receive_putaway/);
  assert.match(migration, /private\.apply_inventory_waste_station_deduction/);
  assert.match(migration, /record_supplier_delivery_pre_station_putaway/);
  assert.match(migration, /storageLocationId/);
  assert.match(migration, /enrich_inventory_event_station_metadata/);
  assert.doesNotMatch(migration, /grant insert on table public\.inventory_location_balances to authenticated/i);
  assert.doesNotMatch(migration, /grant update on table public\.inventory_events to authenticated/i);
});
