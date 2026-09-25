import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildFinalAuthenticatedTablePrivileges,
  hasAuthenticatedTableDml
} from "../scripts/sql-table-privileges.mjs";

const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");

function parseSelectOnlyAuthenticatedTables(source: string): Set<string> {
  const block = source.match(/const selectOnlyAuthenticatedTables = new Set\(\[([\s\S]*?)\]\)/)?.[1];
  assert.ok(block, "selectOnlyAuthenticatedTables set must be present");
  const tables = [...block.matchAll(/"([a-z_]+)"/g)]
    .map((match) => match[1])
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  return new Set(tables);
}

const HIGH_BLAST_RADIUS_SELECT_ONLY_TABLES = [
  "inventory_events",
  "activity_events",
  "restaurant_tasks",
  "restaurant_task_dependencies",
  "recalculation_runs",
  "mise_actions",
  "action_outcomes",
  "supplier_deliveries",
  "supplier_delivery_items",
  "supplier_order_confirmations",
  "menu_items",
  "recipe_versions",
  "recipe_ingredients",
  "pos_catalog_item_mappings",
  "ingredient_substitutions",
  "modifier_recipe_adjustments",
  "restaurants",
  "restaurant_memberships",
  "users",
  "suppliers",
  "operational_finding_decisions"
] as const;

test("security-backend pins high-blast-radius Edge-owned tables as SELECT-only", () => {
  const pinned = parseSelectOnlyAuthenticatedTables(securityBackend);

  for (const table of HIGH_BLAST_RADIUS_SELECT_ONLY_TABLES) {
    assert.ok(pinned.has(table), `public.${table} must be pinned as SELECT-only`);
  }

  assert.match(
    securityBackend,
    /ends SELECT-only for authenticated but is not pinned in selectOnlyAuthenticatedTables/
  );
});

test("every final authenticated SELECT-only table is pinned against DML regression", () => {
  const pinned = parseSelectOnlyAuthenticatedTables(securityBackend);
  const migrationFiles = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      path: name,
      sql: readFileSync(join("supabase/migrations", name), "utf8")
    }));
  const inventory = buildFinalAuthenticatedTablePrivileges(migrationFiles);

  assert.equal(inventory.unrecognizedPrivilegeStatements.length, 0);

  const selectOnlyTables: string[] = [];
  for (const [table, privileges] of inventory.tables.entries()) {
    if (!privileges.select || hasAuthenticatedTableDml(privileges)) {
      continue;
    }
    selectOnlyTables.push(table);
    assert.ok(
      pinned.has(table),
      `public.${table} ends SELECT-only but is missing from selectOnlyAuthenticatedTables`
    );
  }

  assert.ok(selectOnlyTables.includes("inventory_events"));
  assert.equal(selectOnlyTables.length, pinned.size);

  const inventoryEvents = inventory.tables.get("inventory_events");
  assert.equal(inventoryEvents?.select, true);
  assert.equal(hasAuthenticatedTableDml(inventoryEvents), false);
});

test("synthetic authenticated DML on inventory_events would fail the SELECT-only pin", () => {
  const inventoryEventsWithInsert = {
    select: true,
    insert: true,
    update: false,
    delete: false,
    updateColumns: new Set<string>()
  };
  assert.equal(hasAuthenticatedTableDml(inventoryEventsWithInsert), true);

  const pinned = parseSelectOnlyAuthenticatedTables(securityBackend);
  assert.ok(pinned.has("inventory_events"));
});
