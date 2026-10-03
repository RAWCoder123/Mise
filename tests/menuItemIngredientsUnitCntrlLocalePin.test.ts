import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003190000_mise_005gj_menu_item_ingredients_unit_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalTable = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const recipeSetup = readFileSync(
  new URL(
    "../supabase/migrations/20260713103021_atomic_setup_and_operational_signals.sql",
    import.meta.url
  ),
  "utf8"
);
const recipeWorkflow = readFileSync(
  new URL(
    "../supabase/migrations/20260714183310_secure_operational_workflows.sql",
    import.meta.url
  ),
  "utf8"
);
const quantityBounds = readFileSync(
  new URL(
    "../supabase/migrations/20260714040255_enforce_positive_operational_quantities.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/menu_item_ingredients_unit_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GJ pins menu_item_ingredients.unit CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint menu_item_ingredients_unit_check check \(\s*length\(trim\(unit\)\) between 1 and 40\s*and unit collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`unit collate "C" !~ '[[:cntrl:]]'`),
    "menu_item_ingredients.unit CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(unit)) between 1 and 40"),
    "exact length(trim) bound must match recipe unit writer bound"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(sqlBody, /upsert_recipe/i);
  assert.doesNotMatch(sqlBody, /assign_recipe_menu_item_identity/i);
  assert.doesNotMatch(
    sqlBody,
    /menu_item_ingredients_quantity_used_per_sale_check/,
    "must not reattach quantity CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /menu_item_ingredients_menu_item_name_check/,
    "must not reattach menu_item_name CHECK"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.menu_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_catalog_item_mappings/i);
  assert.ok(
    !migration.includes(`menu_item_name collate "C"`),
    "menu_item_name cntrl pin is out of scope for this tip"
  );
  assert.match(
    migration,
    /not ilike '%quantity_used_per_sale%'/,
    "must leave quantity bounds untouched when dropping prior unit CHECKs"
  );
  assert.ok(
    migration.includes(
      String.raw`!~* '\mlength\s*\(\s*trim\s*\(\s*menu_item_name\s*\)'`
    ),
    "must leave menu_item_name length bounds untouched when dropping prior unit CHECKs"
  );
});

test("original unit had no CHECK; writers allow 1..40; quantity CHECK excludes unit", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.menu_item_ingredients \([\s\S]*?unit text not null/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.menu_item_ingredients \([\s\S]*?unit text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /menu_item_ingredients_unit_check/);

  assert.match(
    recipeSetup,
    /or length\(payload\.unit\) not between 1 and 40/
  );
  assert.match(recipeSetup, /or length\(p_unit\) not between 1 and 40/);
  assert.match(recipeWorkflow, /or length\(p_unit\) not between 1 and 40/);

  assert.match(
    quantityBounds,
    /add constraint menu_item_ingredients_quantity_used_per_sale_check check \(\s*quantity_used_per_sale > 0 and quantity_used_per_sale <= 10000\s*\)/
  );
  assert.doesNotMatch(
    quantityBounds,
    /menu_item_ingredients_quantity_used_per_sale_check[\s\S]*?\bunit\b/
  );
  assert.doesNotMatch(
    quantityBounds,
    /menu_item_ingredients_quantity_used_per_sale_check[\s\S]*?\[\[:cntrl:\]\]/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedUnit = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 40 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedUnit("oz"), true);
  assert.equal(isAllowedUnit("a".repeat(40)), true);
  assert.equal(isAllowedUnit("a".repeat(41)), false);
  assert.equal(isAllowedUnit(""), false);
  assert.equal(isAllowedUnit("   "), false);
  assert.equal(isAllowedUnit("o\tz"), false);
  assert.equal(isAllowedUnit("o\nz"), false);
  assert.equal(isAllowedUnit("o\u007fz"), false);
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

  assert.match(pgTap, /unit collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(unit\\\)\\\) between 1 and 40/);
  assert.match(
    pgTap,
    /menu_item_ingredients_quantity_used_per_sale_check remains attached/
  );
  assert.match(
    pgTap,
    /quantity_used_per_sale CHECK still excludes unit cntrl/
  );
  assert.match(
    pgTap,
    /menu_item_ingredients menu_item_name CHECK remains separate from unit on this tip/
  );
  assert.match(pgTap, /tab in recipe unit is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in recipe unit is rejected under COLLATE C/);
});
