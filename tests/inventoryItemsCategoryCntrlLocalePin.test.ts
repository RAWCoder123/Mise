import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003140000_mise_005ge_inventory_items_category_cntrl_locale_pin.sql",
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
const operationalCheck = readFileSync(
  new URL(
    "../supabase/migrations/20260713100023_harden_workflow_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const setupWriter = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_items_category_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GE pins inventory_items.category CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GE"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_items_category_check check \(\s*length\(trim\(category\)\) between 1 and 120\s*and category collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`category collate "C" !~ '[[:cntrl:]]'`),
    "inventory_items.category CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(category)) between 1 and 120"),
    "exact length(trim) bound must match save_restaurant_setup writer"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /inventory_items_operational_values_check/,
    "must not reattach the shared operational_values_check stack"
  );
  assert.doesNotMatch(sqlBody, /item_name collate "C"/);
  assert.doesNotMatch(sqlBody, /unit collate "C"/);
  assert.doesNotMatch(sqlBody, /supplier_name collate "C"/);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.doesNotMatch(sqlBody, /alter table public\.menu_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_count_lines/i);
  assert.match(
    migration,
    /not ilike '%item_name%'/,
    "must leave item_name bounds untouched when dropping prior category CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_name%'/,
    "must leave supplier_name bounds untouched when dropping prior category CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%current_quantity%'/,
    "must leave quantity bounds untouched when dropping prior category CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%canonical_unit%'/,
    "must leave canonical_unit bounds untouched when dropping prior category CHECKs"
  );
});

test("original inventory_items.category had no CHECK; writers bound 1..120; operational check excludes category", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.inventory_items \([\s\S]*?category text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.inventory_items \([\s\S]*?category text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /inventory_items_category_check/);

  const inventoryOperationalMatch = operationalCheck.match(
    /add constraint inventory_items_operational_values_check check \(([\s\S]*?)\);/
  );
  assert.ok(
    inventoryOperationalMatch,
    "harden_workflow_authority must define inventory_items_operational_values_check"
  );
  assert.match(
    inventoryOperationalMatch[1]!,
    /length\(trim\(item_name\)\) between 1 and 160/
  );
  assert.match(
    inventoryOperationalMatch[1]!,
    /length\(trim\(unit\)\) between 1 and 40/
  );
  assert.match(
    inventoryOperationalMatch[1]!,
    /length\(trim\(supplier_name\)\) between 1 and 160/
  );
  assert.doesNotMatch(
    inventoryOperationalMatch[1]!,
    /category/,
    "shared operational_values_check must not include category"
  );

  assert.match(
    setupWriter,
    /pg_catalog\.length\(payload\.category\) not between 1 and 120/
  );
});

test("length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedCategory = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 120 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedCategory("Protein"), true);
  assert.equal(isAllowedCategory("a".repeat(120)), true);
  assert.equal(isAllowedCategory("a".repeat(121)), false);
  assert.equal(isAllowedCategory(""), false);
  assert.equal(isAllowedCategory("   "), false);
  assert.equal(isAllowedCategory("Pro\ttein"), false);
  assert.equal(isAllowedCategory("Pro\ntein"), false);
  assert.equal(isAllowedCategory("Pro\u007ftein"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /category collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(category\\\)\\\) between 1 and 120/);
  assert.match(pgTap, /inventory_items_operational_values_check remains attached/);
  assert.match(
    pgTap,
    /inventory_items_operational_values_check still excludes category/
  );
  assert.match(pgTap, /tab in inventory category is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in inventory category is rejected under COLLATE C/);
});
