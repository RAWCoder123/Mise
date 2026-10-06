import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261006160000_mise_005io_pos_sales_source_pos_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_sales_source_pos_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

test("MISE-005IO pins pos_sales.source_pos length + cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IO"), "additive pin must stay labeled");
  assert.match(
    migration,
    /add constraint pos_sales_source_pos_check check \(/i
  );
  assert.match(
    migration,
    /source_pos collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(pg_catalog\.btrim\(source_pos\)\) between 1 and 80/
  );

  // Compose: CHECK-only. Do not rewrite Square sync / setup / prepare writers
  // or sibling pos_sales CHECKs owned by open tips.
  const sqlBody = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.prepare_square_sales_for_authority/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.save_restaurant_setup/i
  );
  assert.doesNotMatch(sqlBody, /source_record_id collate/i);
  assert.doesNotMatch(sqlBody, /provider_catalog_item_id/i);
  assert.doesNotMatch(sqlBody, /provider_location_id/i);
  assert.doesNotMatch(sqlBody, /provider_variation_id/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /item_name collate/i);
  assert.doesNotMatch(sqlBody, /category collate/i);
});

test("foundation originally left source_pos unbound (prove the gap)", () => {
  assert.match(
    foundation,
    /source_pos text not null default 'Demo POS'/
  );
  assert.doesNotMatch(
    foundation,
    /pos_sales_source_pos_check|source_pos collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    foundation,
    /length\(.*source_pos.*\) between 1 and 80/
  );
});

test("pgTAP fixture pins source_pos CHECK site with plan derived from call sites", () => {
  const assertionSites = [
    ...pgTap.matchAll(/^\s*select\s+(ok|is|matches|throws_ok|lives_ok)\s*\(/gim)
  ];
  assert.equal(
    assertionSites.length,
    8,
    "pgTAP assertion call-site count must stay independently counted"
  );
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /pos_sales_source_pos_check/);
  assert.match(pgTap, /source_pos CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /source_pos CHECK pins length\(btrim\) 1–80 bound/);
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(
    pgTap,
    /printable ASCII Square label is not a control under COLLATE C/
  );
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
  assert.match(
    pgTap,
    /Manual CSV Upload label is not a control under COLLATE C/
  );
  assert.match(pgTap, /Demo POS label is not a control under COLLATE C/);
});
