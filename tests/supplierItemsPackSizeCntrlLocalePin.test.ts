import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004000000_mise_005go_supplier_items_pack_size_cntrl_locale_pin.sql",
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
const purchaseLineLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_items_pack_size_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GO pins supplier_items.pack_size CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GO"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_items_pack_size_check check \(\s*pack_size is null\s*or \(\s*length\(trim\(pack_size\)\) between 1 and 80\s*and pack_size collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`pack_size collate "C" !~ '[[:cntrl:]]'`),
    "supplier_items.pack_size CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(pack_size)) between 1 and 80"),
    "exact length(trim) bound must match purchase_lines.pack_size 1..80 on main"
  );
  assert.ok(migration.includes("pack_size is null"), "nullability must be preserved");

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_line_text/i);
  assert.doesNotMatch(sqlBody, /extract_purchase_pack_size/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_operational_values_check/,
    "must not reattach operational_values_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_items_supplier_sku_check/,
    "must not reattach supplier_sku CHECK by name rewrite"
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
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.match(
    migration,
    /not ilike '%supplier_name%'/,
    "must leave supplier_name bounds untouched when dropping prior pack_size CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%item_name%'/,
    "must leave item_name bounds untouched when dropping prior pack_size CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_sku%'/,
    "must leave supplier_sku bounds untouched when dropping prior pack_size CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%canonical_unit%'/,
    "must leave canonical_unit bounds untouched when dropping prior pack_size CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%verification_status%'/,
    "must leave verification_status bounds untouched when dropping prior pack_size CHECKs"
  );
});

test("original pack_size had no CHECK; operational_values_check omits it; purchase_lines.pack_size bounds 1..80", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.supplier_items \([\s\S]*?pack_size text,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.supplier_items \([\s\S]*?pack_size text[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /supplier_items_pack_size_check/);

  assert.match(
    operationalConstraints,
    /add constraint supplier_items_operational_values_check\s+check \(\s*length\(trim\(supplier_name\)\) > 0 and\s+length\(trim\(item_name\)\) > 0 and\s+length\(trim\(unit\)\) > 0 and\s+estimated_unit_cost >= 0\s*\)/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_items_operational_values_check[\s\S]*pack_size/
  );

  // purchase_lines.pack_size on main is the bound signal (null OR length(btrim)
  // 1..80 plus bare [[:cntrl:]]). The additive migration must keep that exact
  // length ceiling under COLLATE C so catalog pack labels cannot silently
  // drift from the purchase-line pack-size contract.
  assert.match(
    purchaseLineLedger,
    /pack_size text check \(\s*pack_size is null\s*or \(\s*pg_catalog\.length\(pg_catalog\.btrim\(pack_size\)\) between 1 and 80\s*and pack_size !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.match(
    migration,
    /matches purchase_lines\.pack_size\s+1\.\.80 bound on main|purchase_lines\.pack_size/
  );
});

test("nullable length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedPackSize = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 80 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedPackSize(null), true);
  assert.equal(isAllowedPackSize("10 lb case"), true);
  assert.equal(isAllowedPackSize("6/1 GAL"), true);
  assert.equal(isAllowedPackSize("a".repeat(80)), true);
  assert.equal(isAllowedPackSize("a".repeat(81)), false);
  assert.equal(isAllowedPackSize(""), false);
  assert.equal(isAllowedPackSize("   "), false);
  assert.equal(isAllowedPackSize("10\tlb case"), false);
  assert.equal(isAllowedPackSize("10\nlb case"), false);
  assert.equal(isAllowedPackSize("10\u007flb case"), false);
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

  assert.match(pgTap, /pack_size collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(pack_size\\\)\\\) between 1 and 80/
  );
  assert.match(pgTap, /supplier_items operational_values_check remains attached/);
  assert.match(
    pgTap,
    /supplier_items operational_values_check still excludes pack_size cntrl/
  );
  assert.match(pgTap, /tab in pack-size label is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in pack-size label is rejected under COLLATE C/);
});
