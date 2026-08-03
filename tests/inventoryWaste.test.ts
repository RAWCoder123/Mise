import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertWasteStationAvailability,
  canRecordInventoryWaste,
  planInventoryWaste,
  planWasteLocationDeduction
} from "../services/domain/inventoryWaste";
import {
  operatingLimits,
  requireInventoryWasteNote,
  requireInventoryWasteQuantity
} from "../services/miseValidation";
import { canRecordInventoryWaste as canRecordInventoryWasteForRestaurant } from "../services/tenantAccess";
import type { RestaurantMembership } from "../types/mise";

test("planInventoryWaste deducts waste and floors at zero without going negative", () => {
  const planned = planInventoryWaste({
    quantityBefore: 12,
    quantityRemoved: 4.5,
    note: "  Spoiled lettuce  "
  });

  assert.equal(planned.quantityBefore, 12);
  assert.equal(planned.quantityRemovedRequested, 4.5);
  assert.equal(planned.quantityRemovedApplied, 4.5);
  assert.equal(planned.quantityAfter, 7.5);
  assert.equal(planned.floored, false);
  assert.equal(planned.metadata.note, "Spoiled lettuce");
  assert.equal(planned.reason, "waste");
  assert.equal(planned.sourceWorkflow, "record_waste");
});

test("planInventoryWaste floors excess waste requests at zero and records the request", () => {
  const planned = planInventoryWaste({
    quantityBefore: 3,
    quantityRemoved: 10,
    note: null
  });

  assert.equal(planned.quantityAfter, 0);
  assert.equal(planned.quantityRemovedApplied, 3);
  assert.equal(planned.floored, true);
  assert.equal(planned.metadata.quantity_removed_requested, 10);
  assert.equal(planned.metadata.quantity_removed_applied, 3);
});

test("requireInventoryWasteQuantity rejects zero, negative, and unbounded values", () => {
  assert.throws(() => requireInventoryWasteQuantity(0), /greater than zero/i);
  assert.throws(() => requireInventoryWasteQuantity(-1), /greater than zero/i);
  assert.throws(
    () => requireInventoryWasteQuantity(operatingLimits.inventoryQuantity + 1),
    /no more than/i
  );
  assert.equal(requireInventoryWasteQuantity(2.25), 2.25);
});

test("requireInventoryWasteNote trims and bounds optional notes", () => {
  assert.equal(requireInventoryWasteNote(undefined), null);
  assert.equal(requireInventoryWasteNote("  trim me  "), "trim me");
  assert.throws(() => requireInventoryWasteNote("x".repeat(241)), /240/i);
});

test("staff may record waste while remaining outside manager inventory edit roles", () => {
  assert.equal(canRecordInventoryWaste("staff"), true);
  assert.equal(canRecordInventoryWaste("manager"), true);
  assert.equal(canRecordInventoryWaste("owner"), true);
  assert.equal(canRecordInventoryWaste("admin"), true);
  assert.equal(canRecordInventoryWaste(null), false);

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
  assert.equal(canRecordInventoryWasteForRestaurant(staffMembership, "restaurant_a"), true);
  assert.equal(canRecordInventoryWasteForRestaurant(staffMembership, "restaurant_b"), false);
});

test("inventory list and staff detail surface waste recording without manager count edits", () => {
  const list = readFileSync("app/(tabs)/inventory.tsx", "utf8");
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const today = readFileSync("app/(tabs)/today.tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");

  assert.match(list, /canRecordInventoryWaste/);
  assert.match(list, /canRecordWaste \? \(/);
  assert.match(list, /inventory\.waste\.cardTitle/);
  assert.match(list, /searchInputRef\.current\?\.focus\(\)/);
  assert.match(detail, /showWasteBeforeCountSettings = canRecordWaste && !canManage/);
  assert.match(detail, /showWasteBeforeCountSettings \? \(/);
  assert.match(detail, /canRecordWaste && !showWasteBeforeCountSettings/);
  assert.match(today, /showStaffWasteTip/);
  assert.match(today, /role === "staff" && canRecordInventoryWaste/);
  assert.match(today, /today\.waste\.cardTitle/);
  assert.match(today, /router\.push\("\/inventory"\)/);
  assert.match(catalog, /"inventory\.waste\.cardTitle": "Record waste"/);
  assert.match(catalog, /"inventory\.waste\.cardTitle": "Registrar merma"/);
  assert.match(catalog, /"inventory\.waste\.cardTitle": "记录损耗"/);
  assert.match(catalog, /"today\.waste\.openInventoryAction": "Open inventory"/);
  assert.match(catalog, /"today\.waste\.openInventoryAction": "Abrir inventario"/);
  assert.match(catalog, /"today\.waste\.openInventoryAction": "打开库存"/);
});

test("assertWasteStationAvailability rejects waste beyond the selected station balance", () => {
  assert.throws(
    () =>
      assertWasteStationAvailability({
        onHandQuantity: 30,
        quantityRemovedApplied: 8,
        storageLocationId: "walk-in",
        mainStorageLocationId: "main",
        balancesBefore: [
          { storageLocationId: "main", quantity: 5 },
          { storageLocationId: "walk-in", quantity: 3 }
        ]
      }),
    /insufficient quantity at the selected storage location/i
  );

  assert.doesNotThrow(() =>
    assertWasteStationAvailability({
      onHandQuantity: 30,
      quantityRemovedApplied: 8,
      storageLocationId: "walk-in",
      mainStorageLocationId: "main",
      balancesBefore: [
        { storageLocationId: "main", quantity: 5 },
        { storageLocationId: "walk-in", quantity: 20 }
      ]
    })
  );
});

test("planWasteLocationDeduction restores Main after reconcile and takes waste from the chosen station", () => {
  // Before: Main=5, Walk-in=20. Waste 8 from Walk-in.
  // After Main-first reconcile: Main=0, Walk-in=17.
  const planned = planWasteLocationDeduction({
    mainStorageLocationId: "main",
    storageLocationId: "walk-in",
    quantityRemoved: 8,
    mainQuantityBefore: 5,
    balancesAfterReconcile: [
      { storageLocationId: "main", quantity: 0 },
      { storageLocationId: "walk-in", quantity: 17 }
    ]
  });

  assert.ok(planned);
  assert.equal(planned?.quantityMovedToMain, 5);
  assert.deepEqual(planned?.balanceUpdates, [
    { storageLocationId: "main", quantityBefore: 0, quantityAfter: 5 },
    { storageLocationId: "walk-in", quantityBefore: 17, quantityAfter: 12 }
  ]);
});

test("planWasteLocationDeduction is a no-op when waste is attributed to Main", () => {
  assert.equal(
    planWasteLocationDeduction({
      mainStorageLocationId: "main",
      storageLocationId: "main",
      quantityRemoved: 4,
      mainQuantityBefore: 10,
      balancesAfterReconcile: [
        { storageLocationId: "main", quantity: 6 },
        { storageLocationId: "walk-in", quantity: 20 }
      ]
    }),
    null
  );
});

test("inventory detail waste form attributes spoilage to a storage station", () => {
  const detail = readFileSync("app/inventory/[id].tsx", "utf8");
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const application = readFileSync("services/application/inventory.ts", "utf8");
  const repository = readFileSync("services/repositories/miseRepository.ts", "utf8");
  const edge = readFileSync("supabase/functions/operational-workflows/index.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260802160000_waste_station_attribution.sql",
    "utf8"
  );

  assert.match(detail, /wasteStorageLocationId/);
  assert.match(detail, /inventory\.detail\.wasteLocation/);
  assert.match(detail, /recordInventoryWaste\([\s\S]*wasteStorageLocationId/);
  assert.match(detail, /resolveInventoryDetailWasteFailureReason/);
  assert.match(detail, /captureMiseError/);
  assert.match(detail, /StatusNotice tone=\{notice\.tone\}/);
  assert.doesNotMatch(detail, /error\s+instanceof\s+Error\s*\?\s*error\.message/);
  assert.match(application, /assertWasteStationAvailability/);
  assert.match(application, /wasteLocation\.id/);
  assert.match(repository, /applyDemoWasteLocationDeduction/);
  assert.match(repository, /storageLocationId/);
  assert.match(edge, /p_storage_location_id/);
  assert.match(migration, /apply_inventory_waste_station_deduction/);
  assert.match(migration, /p_storage_location_id uuid default null/);
  assert.match(catalog, /"inventory\.detail\.wasteLocation": "Waste location"/);
  assert.match(catalog, /"inventory\.detail\.wasteLocation": "Ubicación de merma"/);
  assert.match(catalog, /"inventory\.detail\.wasteLocation": "损耗位置"/);
  assert.match(catalog, /"inventory\.detail\.wasteLocationInsufficient"/);
});
