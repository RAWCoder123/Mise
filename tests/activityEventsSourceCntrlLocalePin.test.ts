import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001330000_mise_005fc_activity_events_source_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/activity_events_source_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FC pins activity_events.source CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint activity_events_source_check check \(\s*length\(trim\(source\)\) between 1 and 80\s*and source collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`source collate "C" !~ '[[:cntrl:]]'`),
    "activity_events source CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(source)) between 1 and 80"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite activity RPCs or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_activity/i);
  assert.doesNotMatch(sqlBody, /activity_events_title/i);
  assert.doesNotMatch(sqlBody, /activity_events_summary/i);
  assert.doesNotMatch(sqlBody, /activity_events_trigger_type/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
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
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched"
  );
});

test("original activity_events.source CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.activity_events \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 80\)[\s\S]{0,120}\[\[:cntrl:\]\]/
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

  assert.match(pgTap, /source collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(source\\\)\\\) between 1 and 80/);
  assert.match(pgTap, /tab in activity source is rejected/);
  assert.match(pgTap, /DEL in activity source is rejected/);
});
