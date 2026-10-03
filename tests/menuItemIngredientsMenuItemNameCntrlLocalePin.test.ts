import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003180000_mise_005gi_menu_item_ingredients_menu_item_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/menu_item_ingredients_menu_item_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GI pins menu_item_ingredients.menu_item_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GI"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint menu_item_ingredients_menu_item_name_check check \(\s*length\(trim\(menu_item_name\)\) between 1 and 200\s*and menu_item_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`menu_item_name collate "C" !~ '[[:cntrl:]]'`),
    "menu_item_ingredients.menu_item_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(menu_item_name)) between 1 and 200"),
    "exact length(trim) bound must match recipe menu_item_name writer bound"
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
  assert.doesNotMatch(sqlBody, /alter table public\.menu_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_catalog_item_mappings/i);
  assert.ok(
    !migration.includes(`unit collate "C"`),
    "unit cntrl pin is out of scope for this tip"
  );
  assert.match(
    migration,
    /not ilike '%quantity_used_per_sale%'/,
    "must leave quantity bounds untouched when dropping prior menu_item_name CHECKs"
  );
  assert.ok(
    migration.includes(String.raw`!~* '\mlength\s*\(\s*trim\s*\(\s*unit\s*\)'`),
    "must leave unit length bounds untouched when dropping prior menu_item_name CHECKs"
  );
});

test("original menu_item_name had no CHECK; writers allow 1..200; quantity CHECK excludes name", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.menu_item_ingredients \([\s\S]*?menu_item_name text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.menu_item_ingredients \([\s\S]*?menu_item_name text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /menu_item_ingredients_menu_item_name_check/);

  assert.match(
    recipeSetup,
    /if length\(payload\.menu_item_name\) not between 1 and 200/
  );
  assert.match(
    recipeSetup,
    /if length\(p_menu_item_name\) not between 1 and 200/
  );
  assert.match(
    recipeWorkflow,
    /if length\(p_menu_item_name\) not between 1 and 200/
  );

  assert.match(
    quantityBounds,
    /add constraint menu_item_ingredients_quantity_used_per_sale_check check \(\s*quantity_used_per_sale > 0 and quantity_used_per_sale <= 10000\s*\)/
  );
  assert.doesNotMatch(
    quantityBounds,
    /menu_item_ingredients_quantity_used_per_sale_check[\s\S]*?menu_item_name/
  );
  assert.doesNotMatch(
    quantityBounds,
    /menu_item_ingredients_quantity_used_per_sale_check[\s\S]*?\[\[:cntrl:\]\]/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedName = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 200 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedName("Margherita Pizza"), true);
  assert.equal(isAllowedName("a".repeat(200)), true);
  assert.equal(isAllowedName("a".repeat(201)), false);
  assert.equal(isAllowedName(""), false);
  assert.equal(isAllowedName("   "), false);
  assert.equal(isAllowedName("Margherita\tPizza"), false);
  assert.equal(isAllowedName("Margherita\nPizza"), false);
  assert.equal(isAllowedName("Margherita\u007fPizza"), false);
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

  assert.match(pgTap, /menu_item_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(menu_item_name\\\)\\\) between 1 and 200/
  );
  assert.match(
    pgTap,
    /menu_item_ingredients_quantity_used_per_sale_check remains attached/
  );
  assert.match(
    pgTap,
    /quantity_used_per_sale CHECK still excludes menu_item_name cntrl/
  );
  assert.match(pgTap, /tab in recipe menu item name is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in recipe menu item name is rejected under COLLATE C/);
});
