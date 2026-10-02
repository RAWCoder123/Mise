import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001370000_mise_005fg_activity_events_trigger_reference_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/activity_events_trigger_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FG pins activity_events.trigger_reference CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint activity_events_trigger_reference_check check \(\s*trigger_reference is null\s*or \(\s*length\(trim\(trigger_reference\)\) between 1 and 240\s*and trigger_reference collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`trigger_reference collate "C" !~ '[[:cntrl:]]'`),
    "activity_events trigger_reference CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(trigger_reference)) between 1 and 240"),
    "exact length(trim) bound must match record_activity writer"
  );

  // Compose: CHECK-only. Do not rewrite activity RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_activity/i);
  assert.doesNotMatch(sqlBody, /activity_events_title/i);
  assert.doesNotMatch(sqlBody, /activity_events_summary/i);
  assert.doesNotMatch(sqlBody, /activity_events_source_check/i);
  assert.doesNotMatch(sqlBody, /activity_events_trigger_type_check/i);
  assert.doesNotMatch(sqlBody, /activity_events_idempotency_key_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /mise_actions/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.match(
    migration,
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%title%'/,
    "must leave title bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%summary%'/,
    "must leave summary bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%source%'/,
    "must leave source bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched"
  );
});

test("original activity_events.trigger_reference had no CHECK; writer already bounds to 240", () => {
  assert.match(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?trigger_type text not null check \(length\(trim\(trigger_type\)\) between 1 and 120\),\s*trigger_reference text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?trigger_reference text[^\n]*check/
  );
  assert.match(
    original,
    /nullif\(left\(trim\(p_trigger_reference\), 240\), ''\)/
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

  assert.match(pgTap, /trigger_reference collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(trigger_reference\\\)\\\) between 1 and 240/
  );
  assert.match(pgTap, /tab in activity trigger_reference is rejected/);
  assert.match(pgTap, /DEL in activity trigger_reference is rejected/);
});
