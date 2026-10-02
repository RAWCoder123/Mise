import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001440000_mise_005fn_mise_actions_rollback_reference_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/mise_actions_rollback_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FN pins mise_actions.rollback_reference CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint mise_actions_rollback_reference_check check \(\s*rollback_reference is null\s*or \(\s*length\(trim\(rollback_reference\)\) between 1 and 240\s*and rollback_reference collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`rollback_reference collate "C" !~ '[[:cntrl:]]'`),
    "mise_actions rollback_reference CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(rollback_reference)) between 1 and 240"),
    "exact length(trim) bound must match sibling action-ledger ID/ref columns"
  );

  // Compose: CHECK-only. Do not rewrite mise_actions writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create or replace trigger/i);
  assert.doesNotMatch(sqlBody, /record_activity/i);
  assert.doesNotMatch(sqlBody, /activity_events/i);
  assert.doesNotMatch(sqlBody, /restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /operational_issues/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /inventory_count_/i);
  assert.doesNotMatch(sqlBody, /operator_note/i);
  assert.doesNotMatch(
    sqlBody,
    /\^[a-z0-9_]/,
    "must not expand to charset allowlist; cntrl-only tip"
  );
  assert.match(
    migration,
    /not ilike '%trigger_type%'/,
    "must leave trigger_type bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%trigger_reference%'/,
    "must leave trigger_reference bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%error_code%'/,
    "must leave error_code bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%error_message%'/,
    "must leave error_message bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%idempotency_key%'/,
    "must leave idempotency_key bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%reason%'/,
    "must leave reason bounds untouched"
  );
});

test("original mise_actions.rollback_reference had no CHECK; writers trim ID refs", () => {
  assert.match(
    original,
    /create table if not exists public\.mise_actions \([\s\S]*?error_message text,\s*rollback_reference text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.mise_actions \([\s\S]*?rollback_reference text[^\n]*check/
  );
  assert.match(
    original,
    /idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\)/
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

  assert.match(pgTap, /rollback_reference collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(rollback_reference\\\)\\\) between 1 and 240/
  );
  assert.match(pgTap, /tab in mise_actions rollback_reference is rejected/);
  assert.match(pgTap, /DEL in mise_actions rollback_reference is rejected/);
});
