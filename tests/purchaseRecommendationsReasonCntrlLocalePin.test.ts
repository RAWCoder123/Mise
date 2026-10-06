import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007060000_mise_005it_purchase_recommendations_reason_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/purchase_recommendations_reason_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = ["[", "\\x00-\\x08", "\\x0B", "\\x0C", "\\x0E-\\x1F", "\\x7F", "]"].join(
  ""
);

test("MISE-005IT pins purchase_recommendations.reason CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005IT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_recommendations_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160\s*and item_name collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(supplier_name\)\) between 1 and 160\s*and supplier_name collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(unit\)\) between 1 and 40\s*and unit collate "C" !~ '\[\[:cntrl:\]\]'\s*and length\(trim\(reason\)\) between 1 and 2000\s*and reason collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`reason collate "C" !~ E'${multilineControlClass}'`),
    "purchase_recommendations.reason CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(`item_name collate "C" !~ '[[:cntrl:]]'`),
    "must preserve MISE-005FX item_name cntrl pin when reattaching the shared CHECK"
  );
  assert.ok(
    migration.includes(`supplier_name collate "C" !~ '[[:cntrl:]]'`),
    "must preserve MISE-005FY supplier_name cntrl pin when reattaching the shared CHECK"
  );
  assert.ok(
    migration.includes(`unit collate "C" !~ '[[:cntrl:]]'`),
    "must preserve MISE-005FZ unit cntrl pin when reattaching the shared CHECK"
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

  // Compose: CHECK-only. Do not rewrite recommendation writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /inventory_items/i);
  assert.doesNotMatch(sqlBody, /pos_sales/i);
  assert.doesNotMatch(sqlBody, /inventory_count/i);
  assert.doesNotMatch(sqlBody, /create_pending_purchase_recommendation/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  // reason must use multiline-aware class, not full [[:cntrl:]]
  assert.doesNotMatch(
    sqlBody,
    /reason collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("original purchase_recommendations_operational_values_check had reason length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint purchase_recommendations_operational_values_check check \(\s*length\(trim\(item_name\)\) between 1 and 160 and\s*length\(trim\(supplier_name\)\) between 1 and 160 and\s*length\(trim\(unit\)\) between 1 and 40 and\s*length\(trim\(reason\)\) between 1 and 2000 and\s*recommended_quantity > 0 and\s*recommended_quantity <= 1000000\s*\)/
  );
  assert.doesNotMatch(
    original,
    /purchase_recommendations_operational_values_check[\s\S]*?(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("client supplier-send multiline control allowlist matches the reason CHECK class", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
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

  assert.ok(
    pgTap.includes(`!~ E'${multilineControlClass}'`),
    "pgTAP must exercise the exact COLLATE C multiline control class"
  );
  assert.match(pgTap, /length\\\(trim\\\(reason\\\)\\\) between 1 and 2000/);
  assert.match(pgTap, /item_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /supplier_name collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /unit collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /LF in purchase recommendation reason is accepted/);
  assert.match(pgTap, /DEL in purchase recommendation reason is rejected/);
});

test("pgTAP fixture pins purchase_recommendations.reason to COLLATE C multiline allowlist", () => {
  assert.match(
    pgTap,
    /purchase_recommendations_operational_values_check exists/
  );
  assert.match(
    pgTap,
    /purchase_recommendations reason CHECK keeps exact length bound/
  );
  assert.match(
    pgTap,
    /purchase_recommendations reason CHECK uses COLLATE C multiline-aware cntrl rejection/
  );
  assert.match(
    pgTap,
    /purchase_recommendations item_name CHECK keeps MISE-005FX cntrl pin/
  );
  assert.match(
    pgTap,
    /purchase_recommendations supplier_name CHECK keeps MISE-005FY cntrl pin/
  );
  assert.match(
    pgTap,
    /purchase_recommendations unit CHECK keeps MISE-005FZ cntrl pin/
  );
  assert.match(
    pgTap,
    /printable purchase recommendation reason is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /LF in purchase recommendation reason is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /TAB in purchase recommendation reason is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /CR in purchase recommendation reason is accepted under COLLATE C/
  );
  assert.match(
    pgTap,
    /BS in purchase recommendation reason is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /VT in purchase recommendation reason is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /DEL in purchase recommendation reason is rejected under COLLATE C/
  );
});
