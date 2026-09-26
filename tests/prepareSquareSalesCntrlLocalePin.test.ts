import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926150000_mise_005u_prepare_square_sales_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original003a = readFileSync(
  new URL(
    "../supabase/migrations/20260822063410_mise_003a_authority_correction.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/prepare_square_sales_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005U pins prepare_square_sales_for_authority cntrl preflights to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005U"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.prepare_square_sales_for_authority\(\s*p_restaurant_id uuid,\s*p_integration_id uuid,\s*p_sales jsonb,\s*p_catalog_items jsonb,\s*p_from date,\s*p_to date,\s*p_require_complete boolean/i
  );
  assert.match(
    migration,
    /or sale_source_record_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(migration, /or item_name collate "C" ~ '\[\[:cntrl:\]\]'/);
  assert.match(
    migration,
    /or coalesce\(incoming_location_id, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /or coalesce\(incoming_variation_id, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /or coalesce\(incoming_catalog_item_id, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /or derived_catalog_item_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /revoke all on function private\.prepare_square_sales_for_authority\(\s*uuid, uuid, jsonb, jsonb, date, date, boolean\s*\)\s*from public, anon, authenticated, service_role/i
  );

  const functionBody = migration.slice(
    migration.indexOf(
      "create or replace function private.prepare_square_sales_for_authority"
    )
  );
  // Function body must not keep bare (unpinned) cntrl preflights.
  assert.doesNotMatch(
    functionBody,
    /or sale_source_record_id ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(functionBody, /or item_name ~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(
    functionBody,
    /or coalesce\(incoming_location_id, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    functionBody,
    /or coalesce\(incoming_variation_id, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    functionBody,
    /or coalesce\(incoming_catalog_item_id, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    functionBody,
    /or derived_catalog_item_id ~ '\[\[:cntrl:\]\]'/
  );

  // Compose with MISE-005I: do not reattach pos_sales provider-identity CHECKs
  // or rewrite Square sync wrappers.
  assert.doesNotMatch(migration, /pos_sales_provider_catalog_item_id_check/);
  assert.doesNotMatch(migration, /pos_sales_provider_location_id_check/);
  assert.doesNotMatch(migration, /pos_sales_provider_variation_id_check/);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_begin_square_authority_sync/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_apply_square_sync_result/i
  );
});

test("MISE-003A originally left prepare_square cntrl preflights unpinned", () => {
  assert.match(original003a, /or sale_source_record_id ~ '\[\[:cntrl:\]\]'/);
  assert.match(original003a, /or item_name ~ '\[\[:cntrl:\]\]'/);
  assert.match(
    original003a,
    /or coalesce\(incoming_catalog_item_id, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(original003a, /or derived_catalog_item_id ~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(
    original003a,
    /or sale_source_record_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins prepare_square cntrl preflights to COLLATE C", () => {
  assert.match(pgTap, /select plan\(5\)/);
  assert.match(
    pgTap,
    /prepare sale_source_record_id cntrl preflight uses COLLATE C/
  );
  assert.match(
    pgTap,
    /prepare provider-identity cntrl preflights use COLLATE C/
  );
  assert.match(
    pgTap,
    /prepare derived_catalog_item_id cntrl preflight uses COLLATE C/
  );
  assert.match(
    pgTap,
    /authenticated lacks EXECUTE on prepare_square_sales_for_authority/
  );
});
