import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003160000_mise_005gg_menu_items_name_cntrl_locale_pin.sql",
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
const recipeSetup = readFileSync(
  new URL(
    "../supabase/migrations/20260713103021_atomic_setup_and_operational_signals.sql",
    import.meta.url
  ),
  "utf8"
);
const recipeAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/menu_items_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GG pins menu_items.name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint menu_items_name_check check \(\s*length\(trim\(name\)\) between 1 and 200\s*and name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`name collate "C" !~ '[[:cntrl:]]'`),
    "menu_items.name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(name)) between 1 and 200"),
    "exact length(trim) bound must match recipe menu_item_name writer bound"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /prepare_square/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(sqlBody, /assign_recipe_menu_item_identity/i);
  assert.doesNotMatch(
    sqlBody,
    /menu_items_recipe_authority_check/,
    "must not reattach recipe authority CHECK"
  );
  assert.doesNotMatch(
    sqlBody,
    /menu_items_category_check/,
    "must not reattach category CHECK"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.match(
    migration,
    /not ilike '%recipe_revision%'/,
    "must leave recipe_revision bounds untouched when dropping prior name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%recipe_confirmed%'/,
    "must leave recipe confirmation bounds untouched when dropping prior name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%category%'/,
    "must leave category bounds untouched when dropping prior name CHECKs"
  );
});

test("original menu_items.name had no CHECK; Square left(..., 160); recipe writers allow 1..200", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.menu_items \([\s\S]*?name text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.menu_items \([\s\S]*?name text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /menu_items_name_check/);

  assert.match(
    squareSync,
    /catalog_external_name := left\(trim\(coalesce\(catalog_item->>'external_name', ''\)\), 160\)/
  );

  assert.match(
    recipeSetup,
    /if length\(payload\.menu_item_name\) not between 1 and 200/
  );
  assert.match(
    recipeSetup,
    /if length\(p_menu_item_name\) not between 1 and 200/
  );

  const recipeMatch = recipeAuthority.match(
    /add constraint menu_items_recipe_authority_check check \(([\s\S]*?)\);/
  );
  assert.ok(
    recipeMatch,
    "purchase approval authority must define menu_items_recipe_authority_check"
  );
  assert.match(recipeMatch[1]!, /recipe_revision >= 0/);
  assert.doesNotMatch(
    recipeMatch[1]!,
    /\yname\y/,
    "recipe authority CHECK must not include name"
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
  // Square writer subset: 160 printable chars remain inside the 200 bound.
  assert.equal(isAllowedName("a".repeat(160)), true);
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

  assert.match(pgTap, /name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(name\\\)\\\) between 1 and 200/);
  assert.match(pgTap, /menu_items_recipe_authority_check remains attached/);
  assert.match(
    pgTap,
    /menu_items_recipe_authority_check still excludes name cntrl/
  );
  assert.match(pgTap, /tab in menu name is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in menu name is rejected under COLLATE C/);
});
