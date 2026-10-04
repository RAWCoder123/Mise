import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004080000_mise_005gv_supplier_orders_supplier_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/supplier_orders_supplier_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GV pins supplier_orders.supplier_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GV"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_orders_supplier_name_check check \(\s*length\(trim\(supplier_name\)\) between 1 and 160\s*and supplier_name collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`supplier_name collate "C" !~ '[[:cntrl:]]'`),
    "supplier_orders.supplier_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(supplier_name)) between 1 and 160"),
    "exact length(trim) bound must match inventory_items.supplier_name 1..160 on main"
  );
  assert.ok(
    !migration.includes("supplier_name is null"),
    "supplier_name is NOT NULL; dedicated CHECK must not add a null OR branch"
  );

  // Compose: dedicated CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /supplier_orders_operational_values_check/,
    "must not reattach operational_values_check by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_orders_operator_note/,
    "must not reattach operator_note CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_orders_email_delivery_check/,
    "must not reattach email_delivery CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_orders_message_size_check/,
    "must not reattach message_size CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_orders_purchase_authority_check/,
    "must not reattach purchase_authority CHECK by name rewrite"
  );
  assert.doesNotMatch(
    sqlBody,
    /supplier_orders_send_content_revision_check/,
    "must not reattach send_content_revision CHECK by name rewrite"
  );
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_items/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.match(
    migration,
    /not ilike '%order_message%'/,
    "must leave operational_values order_message untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%operator_note%'/,
    "must leave operator_note bounds untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status bounds untouched when dropping prior supplier_name CHECKs"
  );
  assert.match(
    migration,
    /not ilike '%supplier_id%'/,
    "must leave supplier_id-related CHECKs untouched when dropping prior supplier_name CHECKs"
  );
});

test("original supplier_name had no dedicated CHECK; operational_values_check is length>0 only; inventory_items.supplier_name bounds 1..160", () => {
  assert.match(
    originalTable,
    /create table if not exists public\.supplier_orders \([\s\S]*?supplier_name text not null,/
  );
  assert.doesNotMatch(
    originalTable,
    /create table if not exists public\.supplier_orders \([\s\S]*?supplier_name text not null[^\n]*check/
  );
  assert.doesNotMatch(originalTable, /supplier_orders_supplier_name_check/);

  assert.match(
    operationalConstraints,
    /add constraint supplier_orders_operational_values_check\s+check \(\s*length\(trim\(supplier_name\)\) > 0 and\s+length\(trim\(order_message\)\) > 0\s*\)/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_orders_operational_values_check[\s\S]*?\[\[:cntrl:\]\]/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_orders_operational_values_check[\s\S]*between 1 and 160/
  );

  // inventory_items.supplier_name on main is the bound signal (length(trim)
  // 1..160). The additive migration must keep that exact length ceiling
  // under COLLATE C so supplier-order supplier names cannot silently drift
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

test("NOT NULL length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedSupplierName = (value: string) =>
    value.trim().length >= 1 &&
    value.trim().length <= 160 &&
    !/[\u0000-\u001f\u007f]/.test(value);

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
  assert.match(pgTap, /supplier_orders operational_values_check remains attached/);
  assert.match(
    pgTap,
    /supplier_orders operational_values_check still excludes supplier_name cntrl/
  );
  assert.match(
    pgTap,
    /tab in supplier-order supplier_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in supplier-order supplier_name is rejected under COLLATE C/
  );
});
