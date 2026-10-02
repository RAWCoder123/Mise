import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001310000_mise_005fa_restaurant_memories_correction_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_memories_correction_cntrl_locale_pin.test.sql",
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

test("MISE-005FA pins restaurant_memories.correction CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memories_correction_check check \(\s*correction is null\s*or \(\s*length\(trim\(correction\)\) between 1 and 1000\s*and correction collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`correction collate "C" !~ E'${multilineControlClass}'`),
    "restaurant_memories correction CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(correction)) between 1 and 1000"),
    "exact length(trim) bound must be present"
  );
  assert.ok(migration.includes("correction is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_statement/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_source_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_dedupe_key/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_memory_type/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_scope_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_status_check/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%statement%'/,
    "must leave statement bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%dedupe_key%'/,
    "must leave dedupe_key bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%memory_type%'/,
    "must leave memory_type vocabulary untouched"
  );
  assert.match(
    migration,
    /coalesce\(memory_row\.correction, memory_row\.statement\)/,
    "migration rationale must document correction→summary LF path"
  );
});

test("original restaurant_memories.correction had no length or cntrl CHECK", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?correction text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?correction text[\s\S]{0,80}check\s*\(/i
  );
  assert.match(
    original,
    /correction = case when p_decision = 'corrected' then left\(trim\(p_correction\), 1000\) else correction end/
  );
});

test("correction multiline control class matches the established supplier-send allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.ok(
    migration.includes(`correction collate "C" !~ E'${multilineControlClass}'`),
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
  assert.match(pgTap, /length\\\(trim\\\(correction\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /LF in restaurant memory correction is accepted/);
  assert.match(pgTap, /DEL in restaurant memory correction is rejected/);
});
