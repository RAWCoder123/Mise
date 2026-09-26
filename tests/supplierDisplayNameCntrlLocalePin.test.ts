import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926160000_mise_005v_supplier_display_name_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original003c = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_display_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005V pins create_supplier and rename_supplier cntrl preflights to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005V"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.create_supplier\(\s*p_restaurant_id uuid,\s*p_display_name text/i
  );
  assert.match(
    migration,
    /create or replace function public\.rename_supplier\(\s*p_restaurant_id uuid,\s*p_supplier_id uuid,\s*p_display_name text/i
  );

  const createBody = migration.slice(
    migration.indexOf("create or replace function public.create_supplier"),
    migration.indexOf("create or replace function public.rename_supplier")
  );
  const renameBody = migration.slice(
    migration.indexOf("create or replace function public.rename_supplier")
  );

  assert.match(
    createBody,
    /or coalesce\(p_display_name, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    renameBody,
    /or coalesce\(p_display_name, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    createBody,
    /or coalesce\(p_display_name, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    renameBody,
    /or coalesce\(p_display_name, ''\) ~ '\[\[:cntrl:\]\]'/
  );

  assert.match(
    migration,
    /revoke all on function public\.create_supplier\(\s*uuid, text\s*\)\s*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.create_supplier\(\s*uuid, text\s*\) to authenticated/i
  );
  assert.match(
    migration,
    /revoke all on function public\.rename_supplier\(\s*uuid, uuid, text\s*\)\s*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.rename_supplier\(\s*uuid, uuid, text\s*\)\s+to authenticated/i
  );

  // Compose with MISE-005B: do not reattach the suppliers display_name CHECK or
  // rewrite normalize helpers / setup discovery.
  assert.doesNotMatch(
    migration,
    /alter table public\.suppliers/i
  );
  assert.doesNotMatch(
    migration,
    /add constraint suppliers_display_name_check/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_supplier_display_name/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_supplier_name/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.save_restaurant_setup/i
  );
});

test("MISE-003C originally left create/rename display_name cntrl preflights unpinned", () => {
  assert.match(
    original003c,
    /create or replace function public\.create_supplier\(/i
  );
  assert.match(
    original003c,
    /create or replace function public\.rename_supplier\(/i
  );
  assert.match(
    original003c,
    /or coalesce\(p_display_name, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    original003c,
    /or coalesce\(p_display_name, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins create/rename display_name cntrl preflights to COLLATE C", () => {
  assert.match(pgTap, /select plan\(5\)/);
  assert.match(
    pgTap,
    /create_supplier display_name cntrl preflight uses COLLATE C/
  );
  assert.match(
    pgTap,
    /rename_supplier display_name cntrl preflight uses COLLATE C/
  );
  assert.match(
    pgTap,
    /authenticated retains EXECUTE on create_supplier/
  );
  assert.match(
    pgTap,
    /authenticated retains EXECUTE on rename_supplier/
  );
});
