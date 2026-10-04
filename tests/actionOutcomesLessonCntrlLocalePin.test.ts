import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004140000_mise_005hb_action_outcomes_lesson_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/action_outcomes_lesson_cntrl_locale_pin.test.sql",
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

test("MISE-005HB pins action_outcomes.lesson CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint action_outcomes_lesson_check check \(\s*lesson is null\s*or \(\s*length\(trim\(lesson\)\) between 1 and 1000\s*and lesson collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`lesson collate "C" !~ E'${multilineControlClass}'`),
    "action_outcomes lesson CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(lesson)) between 1 and 1000"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("lesson is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /capture_action_outcome_activity/i);
  assert.doesNotMatch(sqlBody, /measure_outcome/i);
  assert.doesNotMatch(sqlBody, /action_outcomes_idempotency/i);
  assert.doesNotMatch(sqlBody, /idempotency_key_check/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%expected_result%'/,
    "must leave jsonb expected_result bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%actual_result%'/,
    "must leave jsonb actual_result bounds untouched"
  );
  assert.match(
    migration,
    /nullif\(left\(trim\(new\.lesson\), 1000\), ''\)/,
    "migration rationale must document lesson→summary LF path"
  );
});

test("original action_outcomes.lesson had no CHECK; activity writer truncates to 1000", () => {
  assert.match(
    original,
    /create table if not exists public\.action_outcomes \([\s\S]*?lesson text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.action_outcomes \([\s\S]*?lesson text[^\n]*check/
  );
  assert.match(
    original,
    /nullif\(left\(trim\(new\.lesson\), 1000\), ''\)/
  );
});

test("lesson multiline control class matches the established supplier-send allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.ok(
    migration.includes(`lesson collate "C" !~ E'${multilineControlClass}'`),
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
  assert.match(pgTap, /length\\\(trim\\\(lesson\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /LF in action outcome lesson is accepted/);
  assert.match(pgTap, /DEL in action outcome lesson is rejected/);
});
