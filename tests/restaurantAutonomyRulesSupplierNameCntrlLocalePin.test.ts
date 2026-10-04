import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004090000_mise_005gw_restaurant_autonomy_rules_supplier_name_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const durableSupplierIdentity = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
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
    "../supabase/tests/database/restaurant_autonomy_rules_supplier_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GW pins restaurant_autonomy_rules.supplier_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GW"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_autonomy_rules_supplier_name_check check \(\s*supplier_name is null\s*or \(\s*length\(trim\(supplier_name\)\) between 1 and 160\s*and supplier_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`supplier_name collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_autonomy_rules.supplier_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(supplier_name)) between 1 and 160"),
    "exact length(trim) bound must match inventory_items.supplier_name 1..160 on main"
  );
  assert.ok(
    migration.includes("supplier_name is null"),
    "supplier_name is nullable; dedicated CHECK must keep a null OR branch"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /upsert_restaurant_autonomy_rule/i);
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_supplier_scope_check/,
    "must not reattach supplier_scope_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /restaurant_autonomy_rules_execute_guard/,
    "must not reattach execute_guard by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%supplier_id%'/,
    "must leave supplier_scope_check untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%execute%'/,
    "must leave execute_guard untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%operational_category%'/,
    "must leave operational_category bounds untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%communication_type%'/,
    "must leave communication_type bounds untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%spend_limit%'/,
    "must leave spend_limit bounds untouched when dropping prior supplier_name CHECKs"
  );
});

test("original autonomy supplier_name had no CHECK; scope_check is null-pair only; inventory_items.supplier_name bounds 1..160", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_autonomy_rules \([\s\S]*?supplier_name text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_autonomy_rules \([\s\S]*?supplier_name text[^\n]*check/
  );
  assert.doesNotMatch(original, /restaurant_autonomy_rules_supplier_name_check/);

  const scopeCheckMatch = durableSupplierIdentity.match(
    /add constraint restaurant_autonomy_rules_supplier_scope_check\s+check \(\(supplier_name is null\) = \(supplier_id is null\)\)[^;]*/
  );
  assert.ok(
    scopeCheckMatch,
    "MISE-003C must attach restaurant_autonomy_rules_supplier_scope_check as a null-pair only"
  );
  // Bound the scan to the scope_check statement only — the same 003C migration
  // later attaches suppliers_display_name_check with a bare [[:cntrl:]] gate.
  assert.doesNotMatch(scopeCheckMatch[0], /\[\[:cntrl:\]\]/);
  assert.doesNotMatch(scopeCheckMatch[0], /between 1 and 160/);

  // inventory_items.supplier_name on main is the bound signal (length(trim)
  // 1..160). The additive migration must keep that exact length ceiling
  // under COLLATE C so autonomy-rule supplier names cannot silently drift
  // from the inventory supplier_name contract.
  assert.match(
    inventoryItemsAuthority,
    /add constraint inventory_items_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160 and\s*length\(trim\(unit\)\) between 1 and 40 and\s*length\(trim\(supplier_name\)\) between 1 and 160/
  );
  assert.match(
    migration,
    /matches inventory_items\.supplier_name\s+1\.\.160 bound on main|inventory_items\.supplier_name/
  );
});

test("null-or-length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedSupplierName = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 160 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedSupplierName(null), true);
  assert.equal(isAllowedSupplierName("Sysco Fresh"), true);
  assert.equal(isAllowedSupplierName("a".repeat(160)), true);
  assert.equal(isAllowedSupplierName("a".repeat(161)), false);
  assert.equal(isAllowedSupplierName(""), false);
  assert.equal(isAllowedSupplierName("   "), false);
  assert.equal(isAllowedSupplierName("Sysco\tFresh"), false);
  assert.equal(isAllowedSupplierName("Sysco\nFresh"), false);
  assert.equal(isAllowedSupplierName("Sysco\u007fFresh"), false);
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

  assert.match(pgTap, /supplier_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(supplier_name\\\)\\\) between 1 and 160/
  );
  assert.match(
    pgTap,
    /restaurant_autonomy_rules supplier_scope_check remains attached/
  );
  assert.match(
    pgTap,
    /supplier_name CHECK stays dedicated \(excludes supplier_id \/ scope_check\)/
  );
  assert.match(
    pgTap,
    /tab in autonomy-rule supplier_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in autonomy-rule supplier_name is rejected under COLLATE C/
  );
});
