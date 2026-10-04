import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004050000_mise_005gs_supplier_items_unit_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalTable = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const operationalConstraints = readFileSync(
  new URL(
    "../supabase/migrations/20260625212050_operational_constraints.sql",
    import.meta.url
  ),
  "utf8"
);
const inventoryItemsAuthority = readFileSync(
  new URL(
    "../supabase/migrations/20260713100023_harden_workflow_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_items_unit_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GS pins supplier_items.unit CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GS"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_items_unit_check check \(\s*length\(trim\(unit\)\) between 1 and 40\s*and unit collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`unit collate "C" !~ '[[:cntrl:]]'`),
    "supplier_items.unit CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(unit)) between 1 and 40"),
    "exact length(trim) bound must match inventory_items.unit 1..40 on main"
  );
  assert.ok(
    !migration.includes("unit is null"),
    "unit is NOT NULL; dedicated CHECK must not add a null OR branch"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(sqlBody, /capture_inventory_item_supplier_sku/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_operational_values_check/,
    "must not reattach operational_values_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_item_name_check/,
    "must not reattach item_name CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_supplier_sku_check/,
    "must not reattach supplier_sku CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_pack_size_check/,
    "must not reattach pack_size CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_pack_quantity_check/,
    "must not reattach pack_quantity CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_canonical_unit_check/,
    "must not reattach canonical_unit CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_verification_status_check/,
    "must not reattach verification_status CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.match(
    migration,
    /not ilike '%supplier_name%'/,
    "must leave supplier_name bounds untouched when dropping prior unit CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%item_name%'/,
    "must leave item_name bounds untouched when dropping prior unit CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%estimated_unit_cost%'/,
    "must leave operational_values estimated_unit_cost untouched when dropping prior unit CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_sku%'/,
    "must leave supplier_sku bounds untouched when dropping prior unit CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%pack_size%'/,
    "must leave pack_size bounds untouched when dropping prior unit CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%canonical_unit%'/,
    "must leave canonical_unit bounds untouched when dropping prior unit CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%verification_status%'/,
    "must leave verification_status bounds untouched when dropping prior unit CHECKs"
  );
});

test("original unit had no dedicated CHECK; operational_values_check is length>0 only; inventory_items.unit bounds 1..40", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.supplier_items \([\s\S]*?unit text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.supplier_items \([\s\S]*?unit text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /supplier_items_unit_check/);

  assert.match(
    operationalConstraints,
    /add constraint supplier_items_operational_values_check\s+check \(\s*length\(trim\(supplier_name\)\) > 0 and\s+length\(trim\(item_name\)\) > 0 and\s+length\(trim\(unit\)\) > 0 and\s+estimated_unit_cost >= 0\s*\)/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_items_operational_values_check[\s\S]*?\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_items_operational_values_check[\s\S]*between 1 and 40/
  );

  // inventory_items.unit on main is the bound signal (length(trim)
  // 1..40). The additive migration must keep that exact length ceiling
  // under COLLATE C so catalog units cannot silently drift from the
  // inventory unit contract.
  assert.match(
    inventoryItemsAuthority,
    /add constraint inventory_items_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160 and\s*length\(trim\(unit\)\) between 1 and 40/
  );
  assert.match(
    migration,
    /matches inventory_items\.unit\s+1\.\.40 bound on main|inventory_items\.unit/
  );
});

test("NOT NULL length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedUnit = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 40 &&
    !/[\u0000-\u001f\u007f]/.test(value);

  assert.equal(isAllowedUnit("lb"), true);
  assert.equal(isAllowedUnit("a".repeat(40)), true);
  assert.equal(isAllowedUnit("a".repeat(41)), false);
  assert.equal(isAllowedUnit(""), false);
  assert.equal(isAllowedUnit("   "), false);
  assert.equal(isAllowedUnit("lb\tcase"), false);
  assert.equal(isAllowedUnit("lb\ncase"), false);
  assert.equal(isAllowedUnit("lb\u007fcase"), false);
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
  assert.match(pgTap, /supplier_items operational_values_check remains attached/);
  assert.match(
    pgTap,
    /supplier_items operational_values_check still excludes unit cntrl/
  );
  assert.match(pgTap, /tab in catalog unit is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in catalog unit is rejected under COLLATE C/);
});
