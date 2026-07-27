import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
  "utf8"
);
const canonicalUnitMigration = readFileSync(
  "supabase/migrations/20260726233159_inventory_item_canonical_unit_authority.sql",
  "utf8"
);
const projectionMigration = readFileSync(
  "supabase/migrations/20260727203458_inventory_event_projection_authority.sql",
  "utf8"
);
const canonicalTriggerAuthorityMigration = readFileSync(
  "supabase/migrations/20260727204722_canonical_unit_trigger_authority.sql",
  "utf8"
);
const canonicalConversionMigration = readFileSync(
  "supabase/migrations/20260727210306_inventory_canonical_conversion_projection.sql",
  "utf8"
);
const tenantCascadeMigration = readFileSync(
  "supabase/migrations/20260727211036_allow_inventory_history_tenant_cascade.sql",
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

test("inventory events require the item's verified canonical unit", () => {
  assert.match(canonicalUnitMigration, /add column if not exists canonical_unit text/i);
  assert.match(canonicalUnitMigration, /canonical_unit_verification_status/i);
  assert.match(canonicalUnitMigration, /ambiguous|canonical_unit_for_standard_unit/i);
  assert.match(canonicalUnitMigration, /before insert on public\.inventory_events/i);
  assert.match(canonicalUnitMigration, /canonical unit is not verified/i);
  assert.match(canonicalUnitMigration, /does not match inventory item/i);
});

test("accepted inventory events atomically project bounded on-hand quantity", () => {
  assert.match(
    projectionMigration,
    /create or replace function private\.apply_inventory_event_projection/i
  );
  assert.match(projectionMigration, /after insert on public\.inventory_events/i);
  assert.match(
    projectionMigration,
    /when new\.event_type = 'count' then new\.quantity/i
  );
  assert.match(
    projectionMigration,
    /when new\.event_type = 'receipt' then prior_quantity \+ new\.quantity/i
  );
  assert.match(
    projectionMigration,
    /when new\.event_type in \('waste', 'usage'\) then prior_quantity - new\.quantity/i
  );
  assert.match(
    projectionMigration,
    /projected_quantity < 0[\s\S]*projected_quantity > 1000000/i
  );
});

test("canonical-unit verification is manager-authorized and audit backed", () => {
  assert.match(
    canonicalUnitMigration,
    /create or replace function public\.verify_inventory_item_canonical_unit/i
  );
  assert.match(canonicalUnitMigration, /security definer\s+set search_path = ''/i);
  assert.match(
    canonicalUnitMigration,
    /private\.has_restaurant_role\([\s\S]*owner[\s\S]*admin[\s\S]*manager/i
  );
  assert.match(canonicalUnitMigration, /inventory_item\.canonical_unit_verified/i);
  assert.match(
    canonicalUnitMigration,
    /revoke all on function public\.verify_inventory_item_canonical_unit[\s\S]*from public, anon, authenticated/i
  );
});

test("canonical-unit triggers use private authority without becoming callable APIs", () => {
  for (const functionName of [
    "normalize_inventory_item_canonical_unit",
    "enforce_inventory_event_canonical_unit"
  ]) {
    assert.match(
      canonicalTriggerAuthorityMigration,
      new RegExp(`alter function private\\.${functionName}\\(\\)\\s+security definer`, "i")
    );
    assert.match(
      canonicalTriggerAuthorityMigration,
      new RegExp(
        `revoke all on function private\\.${functionName}\\(\\)[\\s\\S]*from public, anon, authenticated, service_role`,
        "i"
      )
    );
  }
});

test("canonical ledger quantities project through a verified item conversion", () => {
  assert.match(
    canonicalConversionMigration,
    /add column if not exists canonical_quantity_per_unit numeric/i
  );
  assert.match(
    canonicalConversionMigration,
    /when 'lb' then 453\.59237/i
  );
  assert.match(
    canonicalConversionMigration,
    /native_event_quantity := new\.quantity \/ quantity_per_unit/i
  );
  assert.match(
    canonicalConversionMigration,
    /canonical_unit_verification_status <> 'verified'[\s\S]*canonical_quantity_per_unit is not null/i
  );
  assert.match(
    canonicalConversionMigration,
    /create function public\.verify_inventory_item_canonical_unit\([\s\S]*p_canonical_quantity_per_unit numeric/i
  );
  assert.match(
    canonicalConversionMigration,
    /Standard-unit canonical conversion cannot be overridden/i
  );
});

test("inventory history permits only nested whole-tenant deletion cascades", () => {
  assert.match(
    tenantCascadeMigration,
    /before delete on public\.restaurants[\s\S]*private\.mark_inventory_event_tenant_delete/i
  );
  assert.match(
    tenantCascadeMigration,
    /current_setting\([\s\S]*mise\.inventory_event_tenant_delete[\s\S]*= 'true'/i
  );
  assert.match(
    tenantCascadeMigration,
    /tg_op = 'UPDATE'[\s\S]*new\.actor_user_id is null[\s\S]*auth\.users/i
  );
  assert.match(
    tenantCascadeMigration,
    /create or replace function private\.bump_restaurant_planning_revision[\s\S]*mise\.inventory_event_tenant_delete/i
  );
  assert.match(
    tenantCascadeMigration,
    /create or replace function private\.bump_recommendation_history_revision[\s\S]*mise\.inventory_event_tenant_delete/i
  );
  assert.match(tenantCascadeMigration, /Inventory events are append-only/i);
  assert.match(
    tenantCascadeMigration,
    /revoke all on function private\.reject_inventory_event_mutation\(\)[\s\S]*service_role/i
  );
});
