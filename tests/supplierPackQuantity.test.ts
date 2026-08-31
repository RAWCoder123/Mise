import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  roundOrderQuantityToPack,
  resolveVerifiedPackQuantity,
  requireSupplierPackQuantity
} from "../services/domain/supplierPackQuantity";
import { calculateOperationalSignals } from "../services/domain/operationalSignals";
import { normalizeSupplierItem } from "../services/miseValidation";
import type { InventoryItem, SupplierItem } from "../types/mise";

function inventory(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    restaurant_id: "restaurant-a",
    item_name: "Chicken thighs",
    category: "Protein",
    unit: "lbs",
    current_quantity: 4,
    par_level: 24,
    reorder_threshold: 8,
    estimated_unit_cost: 3.5,
    supplier_id: "10000000-0000-4000-8000-000000000008",
    supplier_name: "Protein Co",
    last_updated: "2026-08-30T10:00:00.000Z",
    ...overrides
  };
}

function supplier(overrides: Partial<SupplierItem> = {}): SupplierItem {
  return {
    id: "supplier-item-1",
    restaurant_id: "restaurant-a",
    supplier_id: "10000000-0000-4000-8000-000000000008",
    supplier_name: "Protein Co",
    supplier_sku: null,
    inventory_item_id: "item-1",
    item_name: "Chicken thighs",
    unit: "lbs",
    pack_size: "10 lb case",
    pack_quantity: 10,
    verification_status: "verified",
    verified_at: "2026-08-30T11:00:00.000Z",
    verified_by: "manager-1",
    estimated_unit_cost: 3.5,
    preferred: true,
    created_at: "2026-08-30T10:00:00.000Z",
    updated_at: "2026-08-30T11:00:00.000Z",
    ...overrides
  };
}

test("roundOrderQuantityToPack rounds up to verified packs", () => {
  assert.equal(roundOrderQuantityToPack(7, 10), 10);
  assert.equal(roundOrderQuantityToPack(10, 10), 10);
  assert.equal(roundOrderQuantityToPack(11, 10), 20);
  assert.equal(roundOrderQuantityToPack(0.2, null), 1);
  assert.equal(roundOrderQuantityToPack(7, 1), 7);
  assert.equal(roundOrderQuantityToPack(7, undefined), 7);
});

test("resolveVerifiedPackQuantity prefers linked verified preferred rows", () => {
  const pack = resolveVerifiedPackQuantity("restaurant-a", inventory(), [
    supplier({ preferred: false, pack_quantity: 6, id: "a" }),
    supplier({ preferred: true, pack_quantity: 10, id: "b" })
  ]);
  assert.equal(pack, 10);
});

test("resolveVerifiedPackQuantity ignores unverified pack quantities", () => {
  const pack = resolveVerifiedPackQuantity("restaurant-a", inventory(), [
    supplier({ verification_status: "draft", verified_at: null, verified_by: null })
  ]);
  assert.equal(pack, null);
});

test("normalizeSupplierItem downgrades verified status without evidence", () => {
  const normalized = normalizeSupplierItem(
    supplier({ verification_status: "verified", verified_at: null, pack_quantity: 10 })
  );
  assert.equal(normalized.verification_status, "draft");
  assert.equal(normalized.verified_at, null);
  assert.equal(normalized.pack_quantity, 10);
});

test("requireSupplierPackQuantity rejects non-positive values", () => {
  assert.equal(requireSupplierPackQuantity(12), 12);
  assert.throws(() => requireSupplierPackQuantity(0));
  assert.throws(() => requireSupplierPackQuantity(-3));
});

test("operational signals round recommendations to verified supplier packs", () => {
  const signals = calculateOperationalSignals({
    restaurantId: "restaurant-a",
    operatingDate: "2026-08-30",
    inventoryItems: [
      {
        id: "item-1",
        restaurant_id: "restaurant-a",
        item_name: "Chicken thighs",
        supplier_id: "10000000-0000-4000-8000-000000000008",
        supplier_name: "Protein Co",
        unit: "lbs",
        current_quantity: 4,
        par_level: 24,
        reorder_threshold: 8
      }
    ],
    sales: [],
    menuItemIngredients: [],
    recommendationHistory: [],
    inventoryLedgerEvents: [
      {
        restaurantId: "restaurant-a",
        inventoryItemId: "item-1",
        eventType: "count",
        effectiveAt: "2026-08-30T08:00:00.000Z",
        sequence: 1,
        projectionApplied: true
      }
    ],
    ledgerComplete: true,
    timeZone: "America/New_York",
    verifiedSupplierPacks: [{ inventoryItemId: "item-1", packQuantity: 10 }]
  });

  assert.equal(signals.recommendations.length, 1);
  assert.equal(signals.recommendations[0]?.recommended_quantity, 20);
});

test("migration pins pack verification RPC and snapshot pack payload", () => {
  const migration = readFileSync(
    "supabase/migrations/20260831020000_verify_supplier_item_pack_quantity.sql",
    "utf8"
  );
  assert.match(migration, /create or replace function public\.verify_supplier_item_pack_quantity/i);
  assert.match(migration, /private\.has_restaurant_role/i);
  assert.match(migration, /supplier_item\.pack_quantity_verified/);
  assert.match(migration, /grant execute on function public\.verify_supplier_item_pack_quantity/);
  assert.match(migration, /'verifiedSupplierPacks'/);
  assert.match(migration, /verification_status = 'verified'/);
});

test("inventory detail exposes manager pack verification controls", () => {
  const screen = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(screen, /verifySupplierItemPackQuantity/);
  assert.match(screen, /inventory\.detail\.packSettings/);
  assert.match(screen, /inventory\.detail\.verifyPack/);
});
