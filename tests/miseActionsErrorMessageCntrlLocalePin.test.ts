import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001460000_mise_005fp_mise_actions_error_message_cntrl_locale_pin.sql",
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
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/mise_actions_error_message_cntrl_locale_pin.test.sql",
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

test("MISE-005FP pins mise_actions.error_message CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FP"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint mise_actions_error_message_check check \(\s*error_message is null\s*or \(\s*length\(trim\(error_message\)\) between 1 and 1000\s*and error_message collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`error_message collate "C" !~ E'${multilineControlClass}'`),
    "mise_actions error_message CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(error_message)) between 1 and 1000"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("error_message is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite mise_actions writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create or replace trigger/i);
  assert.doesNotMatch(sqlBody, /record_activity/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%trigger_reference%'/,
    "must leave trigger_reference bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%error_code%'/,
    "must leave error_code bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%reason%'/,
    "must leave reason bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%rollback_reference%'/,
    "must leave rollback_reference bounds untouched"
  );
  assert.match(
    migration,
    /left\(trim\(p_error_message\), 1000\)/,
    "migration rationale must document the left(trim) writer shape"
  );
});

test("original mise_actions.error_message had no CHECK; writers truncate to 1000", () => {
  assert.match(
    original,
    /create table if not exists public\.mise_actions \([\s\S]*?error_message text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.mise_actions \([\s\S]*?error_message text[^\n]*check/
  );
  assert.match(
    original,
    /error_message = left\(trim\(p_error_message\), 1000\)/
  );
  assert.match(
    original,
    /or nullif\(trim\(p_error_message\), ''\) is null/
  );
});

test("error_message multiline control class matches the established supplier-send allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.ok(
    migration.includes(`error_message collate "C" !~ E'${multilineControlClass}'`),
    "SQL class must stay byte-aligned with unsafeSupplierSendMultilineControlPattern"
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
  assert.match(pgTap, /length\\\(trim\\\(error_message\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /LF in mise_actions error_message is accepted/);
  assert.match(pgTap, /DEL in mise_actions error_message is rejected/);
});
