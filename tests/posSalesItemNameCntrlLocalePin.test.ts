import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003100000_mise_005ga_pos_sales_item_name_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260714040255_enforce_positive_operational_quantities.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pos_sales_item_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GA pins pos_sales.item_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pos_sales_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 200\s*and item_name collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(category\)\) between 1 and 120\s*and quantity_sold > 0\s*and quantity_sold <= 100000\s*and gross_sales between 0 and 10000000\s*and net_sales between 0 and 10000000\s*\)/
  );

  assert.ok(
    migration.includes(`item_name collate "C" !~ '[[:cntrl:]]'`),
    "pos_sales.item_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("between 1 and 200"),
    "exact pos_sales.item_name length bound must be preserved"
  );
  assert.ok(
    migration.includes("between 1 and 120"),
    "exact pos_sales.category length bound must be preserved"
  );
  assert.ok(
    !migration.includes(`category collate "C"`),
    "category cntrl pin is out of scope for this tip"
  );

  // Compose: CHECK-only. Do not rewrite POS writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /inventory_items/i);
  assert.doesNotMatch(sqlBody, /inventory_count/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /prepare_square/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
});

test("original pos_sales_operational_values_check had item_name length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint pos_sales_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 200 and\s*length\(trim\(category\)\) between 1 and 120 and\s*quantity_sold > 0 and quantity_sold <= 100000 and\s*gross_sales between 0 and 10000000 and\s*net_sales between 0 and 10000000\s*\)/
  );
  assert.doesNotMatch(
    original,
    /pos_sales_operational_values_check[\s\S]*?\[\[:cntrl:\]\]/
  );
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

  assert.match(pgTap, /item_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(item_name\\\)\\\) between 1 and 200/);
  assert.match(pgTap, /length\\\(trim\\\(category\\\)\\\) between 1 and 120/);
  assert.match(pgTap, /quantity_sold > 0/);
  assert.match(pgTap, /quantity_sold <= 100000/);
  assert.match(pgTap, /category collate "C"/);
});

test("pgTAP fixture pins pos_sales.item_name to COLLATE C", () => {
  assert.match(pgTap, /pos_sales_operational_values_check exists/);
  assert.match(pgTap, /pos_sales item_name CHECK keeps exact length bound/);
  assert.match(
    pgTap,
    /pos_sales item_name CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /pos_sales category CHECK keeps exact length bound without cntrl pin/
  );
  assert.match(
    pgTap,
    /printable POS sale item_name is accepted under COLLATE C/
  );
  assert.match(pgTap, /tab in POS sale item_name is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /newline in POS sale item_name is rejected under COLLATE C/
  );
  assert.match(pgTap, /DEL in POS sale item_name is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /POS sale item_name control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
  assert.match(
    pgTap,
    /pos_sales category CHECK remains without cntrl pin on this tip/
  );
});
