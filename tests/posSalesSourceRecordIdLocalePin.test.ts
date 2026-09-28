import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928110000_mise_005bl_pos_sales_source_record_id_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalSetup = readFileSync(
  new URL(
    "../supabase/migrations/20260713103021_atomic_setup_and_operational_signals.sql",
    import.meta.url
  ),
  "utf8"
);
const prepareAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260822063410_mise_003a_authority_correction.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_sales_source_record_id_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005BL pins pos_sales.source_record_id cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BL"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint pos_sales_source_record_id_check check \(/i
  );
  assert.match(
    migration,
    /source_record_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(trim\(source_record_id\)\) between 1 and 200/
  );

  // Compose: CHECK-only. Do not rewrite prepare (owned by open MISE-005U #429),
  // provider-identity CHECKs (MISE-005I #417), or contested ledger paths.
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.prepare_square_sales_for_authority/i
  );
  assert.doesNotMatch(sqlBody, /provider_catalog_item_id/i);
  assert.doesNotMatch(sqlBody, /provider_location_id/i);
  assert.doesNotMatch(sqlBody, /provider_variation_id/i);
  assert.doesNotMatch(sqlBody, /add constraint.*selected_modifier/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
});

test("atomic setup originally left source_record_id length-only (prove the gap)", () => {
  assert.match(
    originalSetup,
    /add constraint pos_sales_source_record_id_check check \(\s*source_record_id is null or length\(trim\(source_record_id\)\) between 1 and 200\s*\)/
  );
  assert.doesNotMatch(
    originalSetup,
    /source_record_id collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("prepare_square still rejects sale_source_record_id cntrl on main (MISE-005U owns COLLATE C rewrite)", () => {
  // Main still has bare POSIX cntrl; open #429 pins COLLATE C on the preflight.
  // This tip only reattaches the table CHECK and must not rewrite prepare.
  assert.match(
    prepareAuthority,
    /sale_source_record_id ~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    prepareAuthority,
    /sale_source_record_id collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP fixture pins source_record_id CHECK site", () => {
  assert.match(pgTap, /select plan\(7\)/);
  assert.match(pgTap, /pos_sales_source_record_id_check/);
  assert.match(pgTap, /source_record_id CHECK uses COLLATE C cntrl rejection/);
  assert.match(
    pgTap,
    /source_record_id CHECK preserves length\(trim\) 1–200 bound/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII sale identity is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /Square-like sale identity is not a control under COLLATE C/
  );
});
