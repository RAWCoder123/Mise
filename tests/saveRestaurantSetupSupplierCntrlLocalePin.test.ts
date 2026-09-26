import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926170000_mise_005w_save_restaurant_setup_supplier_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/save_restaurant_setup_supplier_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

function setupDiscoveryGate(source: string): string {
  const fnStart = source.indexOf(
    "create or replace function public.save_restaurant_setup("
  );
  assert.ok(fnStart >= 0, "save_restaurant_setup must exist");
  const forPayload = source.indexOf("for payload in", fnStart);
  assert.ok(forPayload >= 0, "supplier discovery loop must exist");
  const afterGate = source.indexOf(
    "select supplier.id into resolved_supplier_id",
    forPayload
  );
  assert.ok(afterGate > forPayload, "supplier resolve must follow discovery gate");
  return source.slice(forPayload, afterGate);
}

test("MISE-005W pins save_restaurant_setup supplier discovery cntrl/email to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005W"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.save_restaurant_setup\(\s*p_restaurant_id uuid/i
  );

  const gate = setupDiscoveryGate(migration);

  assert.match(
    gate,
    /pg_catalog\.lower\(\s*pg_catalog\.btrim\(payload\.email\) collate "C"\s*\) collate "C"/
  );
  assert.match(
    gate,
    /or coalesce\(payload\.display_name, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    gate,
    /or payload\.email collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    gate,
    /or payload\.email collate "C" !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );

  assert.doesNotMatch(
    gate,
    /or coalesce\(payload\.display_name, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(gate, /or payload\.email ~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(
    gate,
    /or payload\.email !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.doesNotMatch(
    gate,
    /nullif\(pg_catalog\.lower\(pg_catalog\.btrim\(payload\.email\)\), ''\)/
  );

  assert.match(
    migration,
    /revoke all on function public\.save_restaurant_setup\(\s*uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer\s*\)\s*from public, anon, authenticated, service_role/i
  );
  assert.match(
    migration,
    /grant execute on function public\.save_restaurant_setup\(\s*uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer\s*\)\s*to authenticated/i
  );

  // Compose with sibling locale pins: do not reattach CHECKs or rewrite
  // create/rename / normalize / ingest.
  assert.doesNotMatch(migration, /alter table public\.suppliers/i);
  assert.doesNotMatch(migration, /alter table public\.supplier_recipients/i);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.create_supplier/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.rename_supplier/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.ingest_purchase_lines/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.normalize_supplier_display_name/i
  );
});

test("MISE-003C originally left setup supplier discovery cntrl/email unpinned", () => {
  const gate = setupDiscoveryGate(original003c);
  assert.match(
    gate,
    /or coalesce\(payload\.display_name, ''\) ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(gate, /or payload\.email ~ '\[\[:cntrl:\]\]'/);
  assert.match(
    gate,
    /or payload\.email !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    gate,
    /nullif\(pg_catalog\.lower\(pg_catalog\.btrim\(payload\.email\)\), ''\)/
  );
  assert.doesNotMatch(
    gate,
    /or coalesce\(payload\.display_name, ''\) collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(gate, /payload\.email collate "C"/);
});

test("pgTAP fixture pins save_restaurant_setup supplier discovery to COLLATE C", () => {
  assert.match(pgTap, /select plan\(4\)/);
  assert.match(
    pgTap,
    /save_restaurant_setup supplier discovery display_name cntrl uses COLLATE C/
  );
  assert.match(
    pgTap,
    /save_restaurant_setup supplier discovery email cntrl uses COLLATE C/
  );
  assert.match(
    pgTap,
    /authenticated retains EXECUTE on save_restaurant_setup/
  );
});
