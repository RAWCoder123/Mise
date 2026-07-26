import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
  "utf8"
);

test("operational foundation records every mapping layer and kill switch", () => {
  for (const table of [
    "system_operational_controls",
    "restaurant_operational_controls",
    "pos_locations",
    "menu_items",
    "pos_catalog_item_mappings",
    "recipe_versions",
    "recipe_ingredients",
    "modifier_recipe_adjustments",
    "ingredient_substitutions",
    "inventory_events"
  ]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }

  for (const control of [
    "square_sync_enabled",
    "square_webhooks_enabled",
    "gmail_delivery_enabled",
    "insight_generation_enabled",
    "order_drafting_enabled",
    "stripe_invoicing_enabled"
  ]) {
    assert.match(migration, new RegExp(control, "i"));
  }
});

test("inventory history is append-only and writable only through the manager RPC", () => {
  assert.match(migration, /before update or delete on public\.inventory_events/i);
  assert.match(migration, /Inventory events are append-only/i);
  assert.match(migration, /create or replace function public\.record_inventory_event/i);
  assert.match(migration, /security definer\s+set search_path = ''/i);
  assert.match(migration, /private\.has_restaurant_role\([\s\S]*owner[\s\S]*admin[\s\S]*manager/i);
  assert.match(migration, /revoke all on public\.inventory_events from anon, authenticated/i);
  assert.doesNotMatch(migration, /grant\s+insert[\s\S]*inventory_events[\s\S]*to authenticated/i);
});

test("tenant integrity is enforced with composite mapping and inventory foreign keys", () => {
  assert.match(
    migration,
    /foreign key \(restaurant_id, recipe_version_id\)[\s\S]*references public\.recipe_versions \(restaurant_id, id\)/i
  );
  assert.match(
    migration,
    /foreign key \(restaurant_id, inventory_item_id\)[\s\S]*references public\.inventory_items \(restaurant_id, id\)/i
  );
  assert.match(migration, /unique \(restaurant_id, client_event_id\)/i);
  assert.match(migration, /unique \(restaurant_id, idempotency_key\)/i);
});

test("active recipe versions cannot overlap for the same menu item and location", () => {
  assert.match(migration, /recipe_versions_no_overlapping_active_windows/i);
  assert.match(migration, /exclude using gist/i);
  assert.match(migration, /tstzrange\(effective_from,[\s\S]*with &&/i);
});
