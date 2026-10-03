import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003150000_mise_005gf_menu_items_category_cntrl_locale_pin.sql",
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
const recipeAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260821120000_mise_003a_purchase_approval_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/menu_items_category_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GF pins menu_items.category CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint menu_items_category_check check \(\s*length\(trim\(category\)\) between 1 and 120\s*and category collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`category collate "C" !~ '[[:cntrl:]]'`),
    "menu_items.category CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(category)) between 1 and 120"),
    "exact length(trim) bound must match sibling catalog category bounds"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /prepare_square/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /menu_items_recipe_authority_check/,
    "must not reattach recipe authority CHECK"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.match(
    migration,
    /not ilike '%recipe_revision%'/,
    "must leave recipe_revision bounds untouched when dropping prior category CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%recipe_confirmed%'/,
    "must leave recipe confirmation bounds untouched when dropping prior category CHECKs"
  );
});

test("original menu_items.category had no CHECK; Square writers left(..., 80); recipe check excludes category", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.menu_items \([\s\S]*?category text,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.menu_items \([\s\S]*?category text[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /menu_items_category_check/);

  assert.match(
    squareSync,
    /left\(coalesce\(catalog_item->>'category', 'Square'\), 80\)/
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
    /category/,
    "recipe authority CHECK must not include category"
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedCategory = (value: string | null) => {
    if (value === null) {
      // PostgreSQL CHECK null semantics: NULL expression passes.
      return true;
    }
    return (
      value.trim().length >= 1 &&
      value.trim().length <= 120 &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };

  assert.equal(isAllowedCategory(null), true);
  assert.equal(isAllowedCategory("Appetizers"), true);
  assert.equal(isAllowedCategory("a".repeat(120)), true);
  assert.equal(isAllowedCategory("a".repeat(121)), false);
  assert.equal(isAllowedCategory(""), false);
  assert.equal(isAllowedCategory("   "), false);
  assert.equal(isAllowedCategory("Appe\ttizers"), false);
  assert.equal(isAllowedCategory("Appe\ntizers"), false);
  assert.equal(isAllowedCategory("Appe\u007ftizers"), false);
  // Square writer subset: 80 printable chars remain inside the 120 bound.
  assert.equal(isAllowedCategory("a".repeat(80)), true);
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

  assert.match(pgTap, /category collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(category\\\)\\\) between 1 and 120/);
  assert.match(pgTap, /menu_items_recipe_authority_check remains attached/);
  assert.match(
    pgTap,
    /menu_items_recipe_authority_check still excludes category cntrl/
  );
  assert.match(pgTap, /tab in menu category is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in menu category is rejected under COLLATE C/);
});
