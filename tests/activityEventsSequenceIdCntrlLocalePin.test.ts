import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001400000_mise_005fj_activity_events_sequence_id_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/activity_events_sequence_id_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FJ pins activity_events.sequence_id CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint activity_events_sequence_id_check check \(\s*sequence_id is null\s*or \(\s*length\(trim\(sequence_id\)\) between 1 and 240\s*and sequence_id collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`sequence_id collate "C" !~ '[[:cntrl:]]'`),
    "activity_events sequence_id CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(sequence_id)) between 1 and 240"),
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
  assert.doesNotMatch(sqlBody, /activity_events_trigger_reference_check/i);
  assert.doesNotMatch(sqlBody, /related_entity_type_check/i);
  assert.doesNotMatch(sqlBody, /related_entity_id_check/i);
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
    /not ilike '%related_entity_id%'/,
    "must leave related_entity_id bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%related_entity_type%'/,
    "must leave related_entity_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%trigger_reference%'/,
    "must leave trigger_reference bounds untouched"
  );
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

test("original activity_events.sequence_id had no CHECK; writer already bounds to 240", () => {
  assert.match(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?related_entity_id text,\s*parent_activity_id uuid,\s*sequence_id text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?sequence_id text[^\n]*check/
  );
  assert.match(
    original,
    /nullif\(left\(trim\(p_sequence_id\), 240\), ''\)/
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

  assert.match(pgTap, /sequence_id collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(sequence_id\\\)\\\) between 1 and 240/
  );
  assert.match(pgTap, /tab in activity sequence_id is rejected/);
  assert.match(pgTap, /DEL in activity sequence_id is rejected/);
});
