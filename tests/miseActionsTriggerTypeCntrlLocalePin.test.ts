import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001430000_mise_005fm_mise_actions_trigger_type_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/mise_actions_trigger_type_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005FM pins mise_actions.trigger_type CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005FM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint mise_actions_trigger_type_check check \(\s*trigger_type is null\s*or \(\s*length\(trim\(trigger_type\)\) between 1 and 120\s*and trigger_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`trigger_type collate "C" !~ '[[:cntrl:]]'`),
    "mise_actions trigger_type CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(trigger_type)) between 1 and 120"),
    "exact length(trim) bound must match activity sibling writer"
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
    /not ilike '%rollback_reference%'/,
    "must leave rollback_reference bounds untouched"
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

test("original mise_actions.trigger_type had no CHECK; writers pass system labels", () => {
  assert.match(
    original,
    /create table if not exists public\.mise_actions \([\s\S]*?autonomy_level smallint not null check \(autonomy_level between 1 and 5\),\s*trigger_type text,\s*trigger_reference text,/
  );
  // Bound the negative check to the mise_actions column adjacency so the
  // later activity_events.trigger_type length CHECK cannot false-positive.
  assert.doesNotMatch(
    original,
    /autonomy_level smallint not null check \(autonomy_level between 1 and 5\),\s*trigger_type text[^\n]*check/
  );
  assert.match(
    original,
    /'waiting_for_approval', 3, 'supplier_order_drafted', new\.id::text/
  );
  assert.match(
    original,
    /3::smallint, 'supplier_order_drafted', orders\.id::text/
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

  assert.match(pgTap, /trigger_type collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(trigger_type\\\)\\\) between 1 and 120/
  );
  assert.match(pgTap, /tab in mise_actions trigger_type is rejected/);
  assert.match(pgTap, /DEL in mise_actions trigger_type is rejected/);
});
