import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003200000_mise_005gk_pos_locations_display_name_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalTable = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const squareSync = readFileSync(
  new URL(
    "../supabase/migrations/20260730210000_square_backend_oauth_sync.sql",
    import.meta.url
  ),
  "utf8"
);
const squareTs = readFileSync(
  new URL("../supabase/functions/_shared/square.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_locations_display_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GK pins pos_locations.display_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_locations_display_name_check check \(\s*length\(trim\(display_name\)\) between 1 and 200\s*and display_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`display_name collate "C" !~ '[[:cntrl:]]'`),
    "pos_locations.display_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(display_name)) between 1 and 200"),
    "exact length(trim) bound must match Square left(..., 200) writers"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /prepare_square/i);
  assert.doesNotMatch(sqlBody, /complete_square/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(sqlBody, /service_complete_square/i);
  assert.doesNotMatch(
    sqlBody,
    /pos_locations_status_check/,
    "must not reattach status CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_catalog_item_mappings/i);
  assert.doesNotMatch(sqlBody, /alter table public\.menu_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.match(
    migration,
    /not ilike '%external_location_id%'/,
    "must leave external_location_id bounds untouched when dropping prior display_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status bounds untouched when dropping prior display_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%timezone%'/,
    "must leave timezone bounds untouched when dropping prior display_name CHECKs"
  );
});

test("original display_name had no CHECK; Square writers truncate to 200", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.pos_locations \([\s\S]*?display_name text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.pos_locations \([\s\S]*?display_name text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /pos_locations_display_name_check/);

  assert.match(
    squareSync,
    /left\(location_row->>'display_name', 200\)/
  );
  assert.match(squareTs, /stringField\(record, "name", 200\)/);
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedDisplayName = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedDisplayName("Downtown Counter"), true);
  assert.equal(isAllowedDisplayName("a".repeat(200)), true);
  assert.equal(isAllowedDisplayName("a".repeat(201)), false);
  assert.equal(isAllowedDisplayName(""), false);
  assert.equal(isAllowedDisplayName("   "), false);
  assert.equal(isAllowedDisplayName("Downtown\tCounter"), false);
  assert.equal(isAllowedDisplayName("Downtown\nCounter"), false);
  assert.equal(isAllowedDisplayName("Downtown\u007fCounter"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /display_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(display_name\\\)\\\) between 1 and 200/
  );
  assert.match(pgTap, /pos_locations status CHECK remains attached/);
  assert.match(
    pgTap,
    /pos_locations status CHECK still excludes display_name cntrl/
  );
  assert.match(
    pgTap,
    /tab in POS location display name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in POS location display name is rejected under COLLATE C/
  );
});
