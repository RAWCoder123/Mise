import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003220000_mise_005gm_supplier_items_supplier_sku_cntrl_locale_pin.sql",
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
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_items_supplier_sku_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GM pins supplier_items.supplier_sku CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_items_supplier_sku_check check \(\s*supplier_sku is null\s*or \(\s*length\(trim\(supplier_sku\)\) between 1 and 64\s*and supplier_sku collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`supplier_sku collate "C" !~ '[[:cntrl:]]'`),
    "supplier_items.supplier_sku CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(supplier_sku)) between 1 and 64"),
    "exact length(trim) bound must match open #218 INVENTORY_BARCODE_SKU_MAX_CHARACTERS = 64 writers"
  );
  assert.ok(migration.includes("supplier_sku is null"), "nullability must be preserved");

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /capture_inventory_item_supplier_sku/i);
  assert.doesNotMatch(sqlBody, /normalize_inventory_barcode_token/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_operational_values_check/,
    "must not reattach operational_values_check by name rewrite"
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
  assert.doesNotMatch(sqlBody, /alter table public\.pos_sales/i);
  assert.match(
    migration,
    /not ilike '%supplier_name%'/,
    "must leave supplier_name bounds untouched when dropping prior supplier_sku CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%item_name%'/,
    "must leave item_name bounds untouched when dropping prior supplier_sku CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%canonical_unit%'/,
    "must leave canonical_unit bounds untouched when dropping prior supplier_sku CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%verification_status%'/,
    "must leave verification_status bounds untouched when dropping prior supplier_sku CHECKs"
  );
});

test("original supplier_sku had no CHECK; operational_values_check omits it; open #218 writers bound 1..64", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.supplier_items \([\s\S]*?supplier_sku text,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.supplier_items \([\s\S]*?supplier_sku text[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /supplier_items_supplier_sku_check/);

  assert.match(
    operationalConstraints,
    /add constraint supplier_items_operational_values_check\s+check \(\s*length\(trim\(supplier_name\)\) > 0 and\s+length\(trim\(item_name\)\) > 0 and\s+length\(trim\(unit\)\) > 0 and\s+estimated_unit_cost >= 0\s*\)/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_items_operational_values_check[\s\S]*supplier_sku/
  );

  // Open #218 is the intended writer (INVENTORY_BARCODE_SKU_MAX_CHARACTERS = 64 /
  // length after btrim > 64 plus bare [[:cntrl:]]) and is not on main yet. The
  // additive migration must keep that exact bound so the CHECK cannot silently
  // drift from the writer tip when both land.
  assert.match(
    migration,
    /matches open #218 writer bound|INVENTORY_BARCODE_SKU_MAX_CHARACTERS = 64/
  );
});

test("nullable length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedSupplierSku = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 64 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedSupplierSku(null), true);
  assert.equal(isAllowedSupplierSku("SYS-TOMATO-CASE"), true);
  assert.equal(isAllowedSupplierSku("a".repeat(64)), true);
  assert.equal(isAllowedSupplierSku("a".repeat(65)), false);
  assert.equal(isAllowedSupplierSku(""), false);
  assert.equal(isAllowedSupplierSku("   "), false);
  assert.equal(isAllowedSupplierSku("SYS\tTOMATO"), false);
  assert.equal(isAllowedSupplierSku("SYS\nTOMATO"), false);
  assert.equal(isAllowedSupplierSku("SYS\u007fTOMATO"), false);
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

  assert.match(pgTap, /supplier_sku collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(supplier_sku\\\)\\\) between 1 and 64/
  );
  assert.match(pgTap, /supplier_items operational_values_check remains attached/);
  assert.match(
    pgTap,
    /supplier_items operational_values_check still excludes supplier_sku cntrl/
  );
  assert.match(pgTap, /tab in vendor SKU is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in vendor SKU is rejected under COLLATE C/);
});
