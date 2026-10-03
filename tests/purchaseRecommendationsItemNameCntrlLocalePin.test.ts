import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001900000_mise_005fx_purchase_recommendations_item_name_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/purchase_recommendations_item_name_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FX pins purchase_recommendations.item_name CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_recommendations_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160\s*and item_name collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(supplier_name\)\) between 1 and 160\s*and length\(trim\(unit\)\) between 1 and 40\s*and length\(trim\(reason\)\) between 1 and 2000\s*and recommended_quantity > 0\s*and recommended_quantity <= 1000000\s*\)/
  );

  assert.ok(
    migration.includes(`item_name collate "C" !~ '[[:cntrl:]]'`),
    "purchase_recommendations.item_name CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("between 1 and 160"),
    "exact purchase_recommendations.item_name / supplier_name length bounds must be preserved"
  );
  assert.ok(
    migration.includes("between 1 and 40"),
    "exact purchase_recommendations.unit length bound must be preserved"
  );
  assert.ok(
    migration.includes("between 1 and 2000"),
    "exact purchase_recommendations.reason length bound must be preserved"
  );
  assert.ok(
    !migration.includes(`supplier_name collate "C"`),
    "supplier_name cntrl pin is out of scope for this tip"
  );
  assert.ok(
    !migration.includes(`unit collate "C"`),
    "unit cntrl pin is out of scope for this tip"
  );
  assert.ok(
    !migration.includes(`reason collate "C"`),
    "reason cntrl pin is out of scope for this tip"
  );

  // Compose: CHECK-only. Do not rewrite recommendation writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /inventory_items/i);
  assert.doesNotMatch(sqlBody, /pos_sales/i);
  assert.doesNotMatch(sqlBody, /inventory_count/i);
  assert.doesNotMatch(sqlBody, /create_pending_purchase_recommendation/i);
});

test("original purchase_recommendations_operational_values_check had item_name length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint purchase_recommendations_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160 and\s*length\(trim\(supplier_name\)\) between 1 and 160 and\s*length\(trim\(unit\)\) between 1 and 40 and\s*length\(trim\(reason\)\) between 1 and 2000 and\s*recommended_quantity > 0 and\s*recommended_quantity <= 1000000\s*\)/
  );
  assert.doesNotMatch(
    original,
    /purchase_recommendations_operational_values_check[\s\S]*?\[\[:cntrl:\]\]/
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
  assert.match(
    pgTap,
    /length\\\(trim\\\(supplier_name\\\)\\\) between 1 and 160/
  );
  assert.match(pgTap, /length\\\(trim\\\(unit\\\)\\\) between 1 and 40/);
});

test("pgTAP fixture pins purchase_recommendations.item_name to COLLATE C", () => {
  assert.match(
    pgTap,
    /purchase_recommendations_operational_values_check exists/
  );
  assert.match(
    pgTap,
    /purchase_recommendations item_name CHECK keeps exact length bound/
  );
  assert.match(
    pgTap,
    /purchase_recommendations item_name CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(
    pgTap,
    /printable purchase recommendation item_name is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /tab in purchase recommendation item_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /newline in purchase recommendation item_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in purchase recommendation item_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /purchase recommendation item_name control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});
