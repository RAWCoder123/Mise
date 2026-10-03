import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004020000_mise_005gq_restaurant_memories_rule_reference_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_memories_rule_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GQ pins restaurant_memories.rule_reference CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GQ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_memories_rule_reference_check check \(\s*rule_reference is null\s*or \(\s*length\(trim\(rule_reference\)\) between 1 and 240\s*and rule_reference collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`rule_reference collate "C" !~ '[[:cntrl:]]'`),
    "restaurant_memories rule_reference CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(rule_reference)) between 1 and 240"),
    "exact length(trim) bound must match sibling restaurant memory / action-ledger ID/ref columns"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /update_restaurant_memory/i);
  assert.doesNotMatch(sqlBody, /record_supplier_delivery/i);
  assert.doesNotMatch(sqlBody, /upsert_restaurant_autonomy_rule/i);
  assert.doesNotMatch(sqlBody, /restaurant_autonomy_rules/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_source_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_correction/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_statement/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_dedupe_key_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_memory_type/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_scope_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories_status_check/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]/,
    "must not expand to charset allowlist; cntrl-only tip"
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
    /not ilike '%dedupe_key%'/,
    "must leave dedupe_key bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%memory_type%'/,
    "must leave memory_type vocabulary untouched"
  );
});

test("original restaurant_memories.rule_reference had no CHECK; sibling refs use 240", () => {
  assert.match(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?rule_reference text,\s*dedupe_key text not null check \(length\(trim\(dedupe_key\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.restaurant_memories \([\s\S]*?rule_reference text[^\n]*check/
  );
  assert.match(
    original,
    /dedupe_key text not null check \(length\(trim\(dedupe_key\)\) between 1 and 240\)/
  );
});

test("null-or-length(trim)+cntrl class matches the pinned CHECK contract", () => {
  const isAllowedRuleReference = (value: string | null) =>
    value === null ||
    (value.trim().length >= 1 &&
      value.trim().length <= 240 &&
      !/[\u0000-\u001f\u007f]/.test(value));

  assert.equal(isAllowedRuleReference(null), true);
  assert.equal(
    isAllowedRuleReference("autonomy-rule:a0000000-0000-4000-8000-000000000001"),
    true
  );
  assert.equal(isAllowedRuleReference("a".repeat(240)), true);
  assert.equal(isAllowedRuleReference("a".repeat(241)), false);
  assert.equal(isAllowedRuleReference(""), false);
  assert.equal(isAllowedRuleReference("   "), false);
  assert.equal(isAllowedRuleReference("autonomy-rule:\titem"), false);
  assert.equal(isAllowedRuleReference("autonomy-rule:\nitem"), false);
  assert.equal(isAllowedRuleReference("autonomy-rule:\u007fitem"), false);
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /rule_reference collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(rule_reference\\\)\\\) between 1 and 240/
  );
  assert.match(
    pgTap,
    /restaurant_memories dedupe_key CHECK remains attached/
  );
  assert.match(
    pgTap,
    /rule_reference CHECK stays dedicated \(excludes dedupe_key\)/
  );
  assert.match(pgTap, /tab in restaurant memory rule_reference is rejected/);
  assert.match(pgTap, /DEL in restaurant memory rule_reference is rejected/);
});
