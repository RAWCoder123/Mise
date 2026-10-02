import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001290000_mise_005ey_restaurant_memories_statement_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_memories_statement_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EY pins restaurant_memories.statement CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EY"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memories_statement_check check \(\s*length\(trim\(statement\)\) between 1 and 1000\s*and statement collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`statement collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_memories statement CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(statement)) between 1 and 1000"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_correction/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_source_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_dedupe_key/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_memory_type/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_scope_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_status_check/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.match(
    migration,
    /not ilike '%correction%'/,
    "must leave correction bounds untouched"
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
});

test("original restaurant_memories.statement CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?statement text not null check \(length\(trim\(statement\)\) between 1 and 1000\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?statement text not null check \(length\(trim\(statement\)\) between 1 and 1000\)[\s\S]{0,120}\[\[:cntrl:\]\]/
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

  assert.match(pgTap, /statement collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /length\\\(trim\\\(statement\\\)\\\) between 1 and 1000/);
  assert.match(pgTap, /tab in restaurant memory statement is rejected/);
  assert.match(pgTap, /DEL in restaurant memory statement is rejected/);
});
