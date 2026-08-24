import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeInventoryItem } from "../services/miseValidation";
import type { InventoryItem } from "../types/mise";

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    restaurant_id: "restaurant-a",
    item_name: "Chicken",
    category: "Protein",
    unit: "lb",
    current_quantity: 10,
    par_level: 20,
    reorder_threshold: 5,
    estimated_unit_cost: 4,
    supplier_id: "10000000-0000-4000-8000-000000000008",
    supplier_name: "Supplier A",
    last_updated: "2026-07-26T10:00:00.000Z",
    ...overrides
  };
}

test("normalized inventory items expose deterministic standard unit authority", () => {
  const normalized = normalizeInventoryItem(item());
  assert.equal(normalized.canonical_unit, "g");
  assert.equal(normalized.canonical_quantity_per_unit, 453.59237);
  assert.equal(normalized.canonical_unit_verification_status, "verified");
  assert.equal(
    normalized.canonical_unit_verified_at,
    "2026-07-26T10:00:00.000Z"
  );
});

test("package units remain draft without an explicit canonical verification", () => {
  const normalized = normalizeInventoryItem(item({ unit: "case" }));
  assert.equal(normalized.canonical_unit, null);
  assert.equal(normalized.canonical_unit_verification_status, "draft");
  assert.equal(normalized.canonical_unit_verified_at, null);
});

test("authoritative hosted verification state overrides legacy inference", () => {
  const normalized = normalizeInventoryItem(
    item({
      unit: "case",
      canonical_unit: "each",
      canonical_quantity_per_unit: 24,
      canonical_unit_verification_status: "verified",
      canonical_unit_verified_at: "2026-07-26T11:00:00.000Z",
      canonical_unit_verified_by: "manager-1"
    })
  );
  assert.equal(normalized.canonical_unit, "each");
  assert.equal(normalized.canonical_quantity_per_unit, 24);
  assert.equal(normalized.canonical_unit_verification_status, "verified");
  assert.equal(normalized.canonical_unit_verified_by, "manager-1");
});

test("inconsistent verified package data fails closed in the client shape", () => {
  const normalized = normalizeInventoryItem(
    item({
      unit: "case",
      canonical_unit: null,
      canonical_unit_verification_status: "verified",
      canonical_unit_verified_at: "2026-07-26T11:00:00.000Z"
    })
  );
  assert.equal(normalized.canonical_unit, null);
  assert.equal(normalized.canonical_unit_verification_status, "draft");
});

test("hosted canonical verification uses only the guarded RPC", () => {
  const source = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const start = source.indexOf("async verifyInventoryItemCanonicalUnit");
  const end = source.indexOf("async fetchPlanningData", start);
  const method = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(method, /client\.rpc\(\s*"verify_inventory_item_canonical_unit"/);
  assert.match(method, /p_canonical_quantity_per_unit: canonicalQuantityPerUnit/);
  assert.doesNotMatch(method, /\.from\(\s*"inventory_items"\s*\)/);
  assert.doesNotMatch(method, /\.(?:insert|update|delete)\(/);
});

test("demo verification mirrors authority fields and audit semantics", () => {
  const source = readFileSync("services/repositories/demoRepository.ts", "utf8");
  const start = source.indexOf("async verifyInventoryItemCanonicalUnit");
  const end = source.indexOf("async fetchPlanningData", start);
  const method = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(method, /canonical_unit = canonicalUnit/);
  assert.match(method, /canonical_quantity_per_unit = canonicalQuantityPerUnit/);
  assert.match(method, /canonical_unit_verification_status = "verified"/);
  assert.match(method, /inventory_item\.canonical_unit_verified/);
  assert.match(method, /requireActiveDemoRestaurant\(state, restaurantId\)/);
});
