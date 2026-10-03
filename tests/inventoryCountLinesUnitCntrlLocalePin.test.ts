import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261003120000_mise_005gc_inventory_count_lines_unit_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_count_lines_unit_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GC pins inventory_count_lines.unit CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_count_lines_unit_check check \(\s*char_length\(btrim\(unit\)\) between 1 and 40\s*and unit collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );

  assert.ok(
    migration.includes(`unit collate "C" !~ '[[:cntrl:]]'`),
    "inventory_count_lines.unit CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("char_length(btrim(unit)) between 1 and 40"),
    "exact inventory_count_lines.unit char_length(btrim) bound must be preserved"
  );
  assert.ok(
    !migration.includes(`item_name collate "C"`),
    "item_name cntrl pin is out of scope for this tip"
  );
  assert.ok(
    !migration.includes("inventory_count_lines_item_name_check"),
    "item_name sibling CHECK must not be reattached on this tip"
  );
  assert.ok(
    !migration.includes("inventory_count_lines_note_check"),
    "note CHECK is out of scope for this tip"
  );

  // Compose: CHECK-only. Do not rewrite count RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /inventory_items/i);
  assert.doesNotMatch(sqlBody, /pos_sales/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /service_save_inventory_count/i);
});

test("original inventory_count_lines.unit CHECK had char_length only without cntrl gate", () => {
  assert.match(
    original,
    /unit text not null check \(char_length\(btrim\(unit\)\) between 1 and 40\)/
  );
  assert.match(
    original,
    /item_name text not null check \(char_length\(btrim\(item_name\)\) between 1 and 160\)/
  );
  assert.doesNotMatch(
    original,
    /unit text not null check \(char_length\(btrim\(unit\)\) between 1 and 40\)[\s\S]{0,80}\[\[:cntrl:\]\]/
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

  assert.match(pgTap, /unit collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(unit\\\)\\\) between 1 and 40/
  );
  assert.match(
    pgTap,
    /char_length\\\(btrim\\\(item_name\\\)\\\) between 1 and 160/
  );
  assert.match(pgTap, /item_name CHECK remains separate from unit/);
});

test("pgTAP fixture pins inventory_count_lines.unit to COLLATE C", () => {
  assert.match(pgTap, /inventory_count_lines_unit_check exists/);
  assert.match(
    pgTap,
    /inventory_count_lines unit CHECK keeps exact char_length\(btrim\) bound/
  );
  assert.match(
    pgTap,
    /inventory_count_lines unit CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /inventory_count_lines item_name CHECK keeps exact length bound on its sibling/
  );
  assert.match(
    pgTap,
    /printable inventory count line unit is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /tab in inventory count line unit is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /newline in inventory count line unit is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in inventory count line unit is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /inventory count line unit control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
  assert.match(
    pgTap,
    /inventory_count_lines item_name CHECK remains separate from unit on this tip/
  );
});
