import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001300000_mise_005ez_activity_events_summary_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/activity_events_summary_cntrl_locale_pin.test.sql",
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

test("MISE-005EZ pins activity_events.summary CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint activity_events_summary_check check \(\s*length\(trim\(summary\)\) between 1 and 1000\s*and summary collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`summary collate "C" !~ E'${multilineControlClass}'`),
    "activity_events summary CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(summary)) between 1 and 1000"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite activity RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /append_activity/i);
  assert.doesNotMatch(sqlBody, /record_activity/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
  assert.match(
    migration,
    /not ilike '%title%'/,
    "must leave title bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.match(
    migration,
    /coalesce\(memory_row\.correction, memory_row\.statement\)/,
    "migration rationale must document correction→summary LF path"
  );
});

test("original activity_events.summary CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?summary text not null check \(length\(trim\(summary\)\) between 1 and 1000\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?summary text not null check \(length\(trim\(summary\)\) between 1 and 1000\)[\s\S]{0,160}(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("summary multiline control class matches the established supplier-send allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.ok(
    migration.includes(`summary collate "C" !~ E'${multilineControlClass}'`),
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
  assert.match(pgTap, /length\\\(trim\\\(summary\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /LF in activity summary is accepted/);
  assert.match(pgTap, /DEL in activity summary is rejected/);
});
