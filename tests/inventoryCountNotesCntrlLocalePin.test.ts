import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  requireInventoryCountLineNote,
  requireInventoryCountSessionNote
} from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001180000_mise_005en_inventory_count_notes_cntrl_locale_pin.sql",
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
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_count_notes_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EN pins inventory count note CHECKs to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_count_sessions_note_check check \(\s*note is null\s*or \(\s*char_length\(note\) <= 240\s*and note collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.match(
    migration,
    /add constraint inventory_count_lines_note_check check \(\s*note is null\s*or \(\s*char_length\(note\) <= 240\s*and note collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`note collate "C" !~ '[[:cntrl:]]'`),
    "inventory count note CHECKs must pin cntrl rejection under COLLATE C"
  );
  assert.ok(migration.includes("char_length(note) <= 240"), "exact char_length bound must be preserved");
  assert.ok(migration.includes("note is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite count RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions_status/i);
  assert.doesNotMatch(sqlBody, /discrepancy_reason/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /insights_content_bounds/i);
});

test("original inventory count note CHECKs had char_length only without cntrl gate", () => {
  assert.match(
    original,
    /note text check \(note is null or char_length\(note\) <= 240\)/
  );
  assert.equal(
    (original.match(/note text check \(note is null or char_length\(note\) <= 240\)/g) ?? []).length,
    2,
    "both session and line note columns started as length-only CHECKs"
  );
  assert.doesNotMatch(
    original,
    /note text check \(note is null or char_length\(note\) <= 240\)[\s\S]{0,80}\[\[:cntrl:\]\]/
  );
});

test("requireInventoryCountSessionNote rejects ASCII C control characters", () => {
  assert.equal(requireInventoryCountSessionNote(" Walk-in cooler "), "Walk-in cooler");
  assert.equal(requireInventoryCountSessionNote(""), null);
  assert.equal(requireInventoryCountSessionNote(null), null);
  assert.throws(
    () => requireInventoryCountSessionNote("Walk-in\tcooler"),
    /without control characters/
  );
  assert.throws(
    () => requireInventoryCountSessionNote("Walk-in\ncooler"),
    /without control characters/
  );
  assert.throws(
    () => requireInventoryCountSessionNote("Walk-in\u007fcooler"),
    /without control characters/
  );
  assert.throws(
    () => requireInventoryCountSessionNote("A".repeat(241)),
    /240 characters/
  );
  assert.match(
    validation,
    /export function requireInventoryCountSessionNote[\s\S]*hasControlCharacters\(normalized\)/
  );
});

test("requireInventoryCountLineNote rejects ASCII C control characters", () => {
  assert.equal(requireInventoryCountLineNote(" Case damaged "), "Case damaged");
  assert.equal(requireInventoryCountLineNote(""), null);
  assert.throws(
    () => requireInventoryCountLineNote("Case\tdamaged"),
    /without control characters/
  );
  assert.throws(
    () => requireInventoryCountLineNote("Case\ndamaged"),
    /without control characters/
  );
  assert.throws(
    () => requireInventoryCountLineNote("Case\u007fdamaged"),
    /without control characters/
  );
  assert.throws(
    () => requireInventoryCountLineNote("B".repeat(241)),
    /240 characters/
  );
  assert.match(
    validation,
    /export function requireInventoryCountLineNote[\s\S]*hasControlCharacters\(normalized\)/
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
    pgTap.includes(`note collate "C" !~ ''[[:cntrl:]]''`),
    "pgTAP must exercise the exact COLLATE C cntrl class"
  );
  assert.match(pgTap, /char_length\\\(note\\\) <= 240/);
  assert.match(pgTap, /tab in inventory count note text is rejected/);
  assert.match(pgTap, /DEL in inventory count note text is rejected/);
});
