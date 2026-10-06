import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261008010000_mise_005jb_supplier_deliveries_notes_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const foundation = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_deliveries_notes_cntrl_locale_pin.test.sql",
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

test("MISE-005JB pins supplier_deliveries.notes CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005JB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_deliveries_notes_bound_check check \(\s*notes is null\s*or \(\s*length\(notes\) <= 2000\s*and notes collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`notes collate "C" !~ E'${multilineControlClass}'`),
    "notes CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(migration.includes("length(notes) <= 2000"), "exact length bound must be preserved");
  assert.ok(migration.includes("notes is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite receive writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_supplier_delivery/i);
  assert.doesNotMatch(sqlBody, /discrepancy_reason/i);
  assert.doesNotMatch(sqlBody, /client_delivery_id/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_delivery_items/i);
});

test("foundation originally bounded supplier_deliveries.notes by length only without cntrl gate", () => {
  assert.match(
    foundation,
    /constraint supplier_deliveries_notes_bound_check\s+check \(notes is null or length\(notes\) <= 2000\)/
  );
  assert.doesNotMatch(
    foundation,
    /supplier_deliveries_notes_bound_check[\s\S]{0,160}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("client supplier-send multiline control allowlist matches the notes CHECK byte class", () => {
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
  assert.match(pgTap, /length\\\(notes\\\) <= 2000/);
  assert.match(pgTap, /LF in delivery notes text is accepted/);
  assert.match(pgTap, /DEL in delivery notes text is rejected/);
  assert.match(pgTap, /supplier_deliveries_notes_bound_check exists/);
});
