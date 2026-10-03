import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003170000_mise_005gh_pos_catalog_external_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/pos_catalog_external_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GH pins pos_catalog_item_mappings.external_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_catalog_item_mappings_external_name_check check \(\s*length\(trim\(external_name\)\) between 1 and 160\s*and external_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`external_name collate "C" !~ '[[:cntrl:]]'`),
    "external_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(external_name)) between 1 and 160"),
    "exact length(trim) bound must match Square left(..., 160) writers"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /prepare_square/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(sqlBody, /review_pos_catalog/i);
  assert.doesNotMatch(
    sqlBody,
    /pos_catalog_item_mappings_external_catalog_item_id_check/,
    "must not reattach identity catalog-item-id CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /pos_catalog_item_mappings_external_variation_id_check/,
    "must not reattach identity variation-id CHECK"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.menu_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.match(
    migration,
    /not ilike '%external_catalog_item_id%'/,
    "must leave identity catalog-item-id bounds untouched when dropping prior external_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%external_variation_id%'/,
    "must leave identity variation-id bounds untouched when dropping prior external_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%verification_status%'/,
    "must leave verification_status bounds untouched when dropping prior external_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%confidence%'/,
    "must leave confidence bounds untouched when dropping prior external_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%effective_to%'/,
    "must leave window CHECK bounds untouched when dropping prior external_name CHECKs"
  );
});

test("original external_name had no CHECK; Square writers truncate to 160", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.pos_catalog_item_mappings \([\s\S]*?external_name text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.pos_catalog_item_mappings \([\s\S]*?external_name text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /pos_catalog_item_mappings_external_name_check/);

  assert.match(
    squareSync,
    /catalog_external_name := left\(trim\(coalesce\(catalog_item->>'external_name', ''\)\), 160\)/
  );
  assert.match(squareTs, /external_name: externalName\.slice\(0, 160\)/);
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedExternalName = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 160 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedExternalName("Authority Burger"), true);
  assert.equal(isAllowedExternalName("a".repeat(160)), true);
  assert.equal(isAllowedExternalName("a".repeat(161)), false);
  assert.equal(isAllowedExternalName(""), false);
  assert.equal(isAllowedExternalName("   "), false);
  assert.equal(isAllowedExternalName("Authority\tBurger"), false);
  assert.equal(isAllowedExternalName("Authority\nBurger"), false);
  assert.equal(isAllowedExternalName("Authority\u007fBurger"), false);
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

  assert.match(pgTap, /external_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(external_name\\\)\\\) between 1 and 160/
  );
  assert.match(pgTap, /pos_catalog_item_mapping_window_check remains attached/);
  assert.match(
    pgTap,
    /pos_catalog_item_mapping_window_check still excludes external_name cntrl/
  );
  assert.match(pgTap, /tab in catalog external name is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in catalog external name is rejected under COLLATE C/);
});
