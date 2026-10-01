import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isActiveInventoryItem } from "../services/domain/inventoryActivity";
import { isCountSessionEligibleInventoryItem } from "../services/domain/inventoryCountSessions";
import { buildRecommendationInserts } from "../services/domain/miseDomain";
import type { InventoryItem } from "../types/mise";

const migration = readFileSync(
  "supabase/migrations/20260830150000_set_inventory_item_active.sql",
  "utf8"
);
const screen = readFileSync("app/inventory/[id].tsx", "utf8");
const hub = readFileSync("app/(tabs)/inventory.tsx", "utf8");
const inventoryApplication = readFileSync("services/application/inventory.ts", "utf8");
const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
const demoRepository = readFileSync("services/repositories/demoRepository.ts", "utf8");
const contracts = readFileSync("services/repositories/repositoryContracts.ts", "utf8");
const catalog = readFileSync("i18n/catalog.ts", "utf8");
const types = readFileSync("types/mise.ts", "utf8");
const pgTap = readFileSync("supabase/tests/database/set_inventory_item_active.test.sql", "utf8");

function inventory(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    restaurant_id: "rest-1",
    item_name: "Roma tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 2,
    par_level: 20,
    reorder_threshold: 8,
    estimated_unit_cost: 2,
    supplier_id: "sup-1",
    supplier_name: "Fresh Co",
    last_updated: "2026-08-30T12:00:00.000Z",
    active: true,
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.592,
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

test("set_inventory_item_active is manager+ SECURITY DEFINER with empty search_path", () => {
  assert.match(migration, /create or replace function public\.set_inventory_item_active/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/i);
  assert.match(migration, /inventory_item_activated/i);
  assert.match(migration, /inventory_item_deactivated/i);
  assert.match(migration, /add column if not exists active boolean not null default true/i);
  assert.match(migration, /and active is true/i);
  assert.match(migration, /revoke all on function public\.set_inventory_item_active/i);
  assert.match(migration, /grant execute on function public\.set_inventory_item_active[\s\S]*to authenticated/i);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on public\.inventory_items/i);
});

test("inventory detail toggles active state through the service-owned RPC only", () => {
  assert.match(types, /active\?:\s*boolean/);
  assert.match(inventoryApplication, /export async function setInventoryItemActive/);
  assert.match(inventoryApplication, /repository\.setInventoryItemActive\(/);
  assert.match(inventoryApplication, /Reactivate this inventory item before adding it to an order/);
  assert.match(contracts, /setInventoryItemActive\(/);
  assert.match(repository, /client\.rpc\("set_inventory_item_active"/);
  assert.match(demoRepository, /async setInventoryItemActive\(/);
  assert.match(demoRepository, /inventory_item_activated/);
  assert.match(screen, /setInventoryItemActive\(restaurantId, item\.id, nextActive\)/);
  assert.match(screen, /inventory\.authority\.inactive/);
  assert.match(screen, /inventory\.detail\.action\.deactivate/);
  assert.match(screen, /inventory\.detail\.action\.activate/);
  assert.match(hub, /inventory\.authority\.inactive/);
  assert.doesNotMatch(screen, /\.from\("inventory_items"\)/);
  assert.doesNotMatch(screen, /\.update\(\{[\s\S]*active/);
});

test("inventory item active control is localized for EN, ES, and zh-Hans", () => {
  for (const key of [
    "inventory.authority.inactive",
    "inventory.row.inactive",
    "inventory.detail.inactive.title",
    "inventory.detail.inactive.body",
    "inventory.detail.inactiveOrdering",
    "inventory.detail.action.activate",
    "inventory.detail.action.deactivate",
    "inventory.detail.action.activateAccessibility",
    "inventory.detail.action.deactivateAccessibility",
    "inventory.detail.notice.activated",
    "inventory.detail.notice.deactivated",
    "inventory.detail.error.active"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} must appear once per locale`);
  }
  assert.match(catalog, /"inventory\.authority\.inactive":\s*"Inactive"/);
  assert.match(catalog, /"inventory\.authority\.inactive":\s*"Inactivo"/);
  assert.match(catalog, /"inventory\.authority\.inactive":\s*"已停用"/);
});

test("pgTAP pins execute grants and rejects direct inventory_items updates", () => {
  assert.match(pgTap, /set_inventory_item_active exists/i);
  assert.match(pgTap, /authenticated may execute set_inventory_item_active/i);
  assert.match(pgTap, /authenticated cannot update inventory_items directly/i);
  assert.match(pgTap, /anon cannot execute set_inventory_item_active/i);
});

test("isActiveInventoryItem treats missing active as true", () => {
  assert.equal(isActiveInventoryItem({ active: true }), true);
  assert.equal(isActiveInventoryItem({ active: false }), false);
  assert.equal(isActiveInventoryItem({}), true);
  assert.equal(isActiveInventoryItem(undefined), false);
});

test("inactive inventory items are excluded from count eligibility and recommendations", () => {
  const active = inventory({ id: "active", current_quantity: 1 });
  const inactive = inventory({
    id: "inactive",
    active: false,
    current_quantity: 0
  });

  assert.equal(isCountSessionEligibleInventoryItem(active), true);
  assert.equal(isCountSessionEligibleInventoryItem(inactive), false);

  const recommendations = buildRecommendationInserts(
    "rest-1",
    [active, inactive],
    [],
    [],
    [],
    "2026-08-30"
  );
  assert.deepEqual(
    recommendations.map((entry) => entry.inventory_item_id),
    ["active"]
  );
});
