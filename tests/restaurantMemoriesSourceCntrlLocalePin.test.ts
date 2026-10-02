import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001320000_mise_005fb_restaurant_memories_source_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_memories_source_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FB pins restaurant_memories.source CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memories_source_check check \(\s*length\(trim\(source\)\) between 1 and 120\s*and source collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`source collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_memories source CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(source)) between 1 and 120"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_correction/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_statement/i);
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
});

test("original restaurant_memories.source CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 120\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?source text not null check \(length\(trim\(source\)\) between 1 and 120\)[\s\S]{0,120}\[\[:cntrl:\]\]/
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
  assert.match(pgTap, /length\\\(trim\\\(source\\\)\\\) between 1 and 120/);
  assert.match(pgTap, /tab in restaurant memory source is rejected/);
  assert.match(pgTap, /DEL in restaurant memory source is rejected/);
});
