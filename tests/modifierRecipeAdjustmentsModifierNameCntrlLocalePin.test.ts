import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003210000_mise_005gl_modifier_recipe_adjustments_modifier_name_cntrl_locale_pin.sql",
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
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/modifier_recipe_adjustments_modifier_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GL pins modifier_recipe_adjustments.modifier_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint modifier_recipe_adjustments_modifier_name_check check \(\s*length\(trim\(modifier_name\)\) between 1 and 160\s*and modifier_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`modifier_name collate "C" !~ '[[:cntrl:]]'`),
    "modifier_recipe_adjustments.modifier_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(modifier_name)) between 1 and 160"),
    "exact length(trim) bound must match open #341 MAX_MODIFIER_NAME_LENGTH = 160 writers"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /upsert_modifier/i);
  assert.doesNotMatch(sqlBody, /verify_modifier/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /modifier_recipe_adjustments_external_modifier_id_check/,
    "must not reattach external_modifier_id CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /verification_status_check/,
    "must not reattach verification_status CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.pos_catalog_item_mappings/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.menu_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.recipe_ingredients/i);
  assert.match(
    migration,
    /not ilike '%external_modifier_id%'/,
    "must leave external_modifier_id bounds untouched when dropping prior modifier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%verification_status%'/,
    "must leave verification_status bounds untouched when dropping prior modifier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%canonical_unit%'/,
    "must leave canonical_unit bounds untouched when dropping prior modifier_name CHECKs"
  );
});

test("original modifier_name had no CHECK; open #341 writers bound 1..160", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.modifier_recipe_adjustments \([\s\S]*?modifier_name text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.modifier_recipe_adjustments \([\s\S]*?modifier_name text not null[^\n]*check/
  );
  assert.doesNotMatch(
    originalTable,
    /modifier_recipe_adjustments_modifier_name_check/
  );

  // Open #341 is the intended writer (MAX_MODIFIER_NAME_LENGTH = 160 /
  // char_length > 160 after btrim) and is not on main yet. The additive
  // migration must keep that exact bound so the CHECK cannot silently drift
  // from the writer tip when both land.
  assert.match(
    migration,
    /matches open #341 writer bound|MAX_MODIFIER_NAME_LENGTH = 160/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedModifierName = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 160 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedModifierName("No onion"), true);
  assert.equal(isAllowedModifierName("a".repeat(160)), true);
  assert.equal(isAllowedModifierName("a".repeat(161)), false);
  assert.equal(isAllowedModifierName(""), false);
  assert.equal(isAllowedModifierName("   "), false);
  assert.equal(isAllowedModifierName("No\tonion"), false);
  assert.equal(isAllowedModifierName("No\nonion"), false);
  assert.equal(isAllowedModifierName("No\u007fonion"), false);
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

  assert.match(pgTap, /modifier_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(modifier_name\\\)\\\) between 1 and 160/
  );
  assert.match(
    pgTap,
    /modifier_recipe_adjustments verification_status CHECK remains attached/
  );
  assert.match(
    pgTap,
    /modifier_recipe_adjustments verification_status CHECK still excludes modifier_name cntrl/
  );
  assert.match(pgTap, /tab in POS modifier name is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in POS modifier name is rejected under COLLATE C/);
});
