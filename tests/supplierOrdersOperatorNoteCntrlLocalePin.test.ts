import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001170000_mise_005em_supplier_orders_operator_note_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260714183313_bound_resources_and_staging_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_orders_operator_note_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = ["[", "\\x00-\\x08", "\\x0B", "\\x0C", "\\x0E-\\x1F", "\\x7F", "]"].join("");

test("MISE-005EM pins operator_note CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_orders_operator_note_length_check check \(\s*operator_note is null\s*or \(\s*length\(operator_note\) <= 2000\s*and operator_note collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`operator_note collate "C" !~ E'${multilineControlClass}'`),
    "operator_note CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(migration.includes("length(operator_note) <= 2000"), "exact length bound must be preserved");
  assert.ok(migration.includes("operator_note is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite supplier-send builders or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /order_message/i);
  assert.doesNotMatch(sqlBody, /provider_message_id/i);
  assert.doesNotMatch(sqlBody, /insights_content_bounds/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
});

test("original operator_note CHECK had length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint supplier_orders_operator_note_length_check check \(\s*operator_note is null or length\(operator_note\) <= 2000\s*\)/
  );
  assert.doesNotMatch(
    original,
    /supplier_orders_operator_note_length_check[\s\S]*?(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("client operator-note validator shares the supplier-send multiline control allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    validation,
    /export function requireSupplierOperatorNote[\s\S]*?unsafeSupplierSendMultilineControlPattern\.test\(normalized\)/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(/^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim)
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
  assert.match(pgTap, /length\\\(operator_note\\\) <= 2000/);
  assert.match(pgTap, /LF in operator note text is accepted/);
  assert.match(pgTap, /DEL in operator note text is rejected/);
});
