import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001600000_mise_005fu_inventory_items_item_name_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260713100023_harden_workflow_authority.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_items_item_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FU pins inventory_items.item_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_items_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160\s*and item_name collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(unit\)\) between 1 and 40\s*and length\(trim\(supplier_name\)\) between 1 and 160\s*and current_quantity between 0 and 1000000\s*and par_level between 0 and 1000000\s*and reorder_threshold between 0 and 1000000\s*and estimated_unit_cost between 0 and 1000000\s*\)/
  );

  assert.ok(
    migration.includes(`item_name collate "C" !~ '[[:cntrl:]]'`),
    "inventory_items.item_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("between 1 and 160"),
    "exact inventory_items.item_name length bound must be preserved"
  );
  assert.ok(
    migration.includes("between 1 and 40"),
    "exact inventory_items.unit length bound must be preserved"
  );
  assert.ok(
    !migration.includes(`unit collate "C"`),
    "unit cntrl pin is out of scope for this tip"
  );
  assert.ok(
    !migration.includes(`supplier_name collate "C"`),
    "supplier_name cntrl pin is out of scope for this tip"
  );

  // Compose: CHECK-only. Do not rewrite inventory writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /inventory_count/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
});

test("original inventory_items_operational_values_check had length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint inventory_items_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160 and\s*length\(trim\(unit\)\) between 1 and 40 and\s*length\(trim\(supplier_name\)\) between 1 and 160 and\s*current_quantity between 0 and 1000000 and\s*par_level between 0 and 1000000 and\s*reorder_threshold between 0 and 1000000 and\s*estimated_unit_cost between 0 and 1000000\s*\)/
  );
  assert.doesNotMatch(
    original,
    /inventory_items_operational_values_check[\s\S]*?\[\[:cntrl:\]\]/
  );
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

  assert.match(pgTap, /item_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(item_name\\\)\\\) between 1 and 160/);
  assert.match(pgTap, /length\\\(trim\\\(unit\\\)\\\) between 1 and 40/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(supplier_name\\\)\\\) between 1 and 160/
  );
});

test("pgTAP fixture pins inventory_items.item_name to COLLATE C", () => {
  assert.match(pgTap, /inventory_items_operational_values_check exists/);
  assert.match(pgTap, /inventory_items item_name CHECK keeps exact length bound/);
  assert.match(
    pgTap,
    /inventory_items item_name CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(pgTap, /printable inventory item_name is accepted under COLLATE C/);
  assert.match(pgTap, /tab in inventory item_name is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /newline in inventory item_name is rejected under COLLATE C/
  );
  assert.match(pgTap, /DEL in inventory item_name is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /inventory item_name control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});
