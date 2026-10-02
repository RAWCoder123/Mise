import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001360000_mise_005ff_restaurant_memories_dedupe_key_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_memories_dedupe_key_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FF pins restaurant_memories.dedupe_key CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memories_dedupe_key_check check \(\s*length\(trim\(dedupe_key\)\) between 1 and 240\s*and dedupe_key collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/
  );
  assert.ok(
    migration.includes(`dedupe_key collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_memories dedupe_key CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(dedupe_key)) between 1 and 240"),
    "exact length(trim) bound must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /record_supplier_delivery/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_source_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_correction/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_statement/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_memory_type/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_scope_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_status_check/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.match(
    migration,
    /add constraint restaurant_memories_dedupe_key_check check \(\s*length\(trim\(dedupe_key\)\) between 1 and 240\s*and dedupe_key collate "C" !~ '\[\[:cntrl:\]\]'\s*\)/,
    "add constraint must keep length(trim)+cntrl (not a narrow ASCII charset)"
  );
  assert.match(
    migration,
    /not ilike '%source%'/,
    "must leave source bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%statement%'/,
    "must leave statement bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%correction%'/,
    "must leave correction bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%memory_type%'/,
    "must leave memory_type vocabulary untouched"
  );
});

test("original restaurant_memories.dedupe_key CHECK had length(trim) only without cntrl gate", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?dedupe_key text not null check \(length\(trim\(dedupe_key\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?dedupe_key text not null check \(length\(trim\(dedupe_key\)\) between 1 and 240\)[\s\S]{0,120}\[\[:cntrl:\]\]/
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

  assert.match(pgTap, /dedupe_key collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(dedupe_key\\\)\\\) between 1 and 240/
  );
  assert.match(pgTap, /tab in restaurant memory dedupe_key is rejected/);
  assert.match(pgTap, /DEL in restaurant memory dedupe_key is rejected/);
  assert.match(pgTap, /supplier-delivery-outcome:sysco foods/);
  assert.match(
    pgTap,
    /legacy-supplier-delivery-outcome:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/
  );
});
