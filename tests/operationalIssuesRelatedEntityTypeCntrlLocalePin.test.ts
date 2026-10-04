import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004120000_mise_005gz_operational_issues_related_entity_type_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/operational_issues_related_entity_type_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005GZ pins operational_issues.related_entity_type CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005GZ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_issues_related_entity_type_check check \(\s*related_entity_type is null\s*or \(\s*length\(trim\(related_entity_type\)\) between 1 and 80\s*and related_entity_type collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`related_entity_type collate "C" !~ '[[:cntrl:]]'`),
    "operational_issues related_entity_type CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(related_entity_type)) between 1 and 80"),
    "exact length(trim) bound must mirror activity_events related_entity_type / writer 80 ceiling"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /capture_operational_activity/i);
  assert.doesNotMatch(sqlBody, /operational_issues_title_check/);
  assert.doesNotMatch(sqlBody, /operational_issues_explanation_check/);
  assert.doesNotMatch(sqlBody, /operational_issues_dedupe_key_check/);
  assert.doesNotMatch(sqlBody, /related_entity_id_check/);
  assert.doesNotMatch(sqlBody, /activity_events/);
  assert.doesNotMatch(sqlBody, /restaurant_memories/);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/);
  assert.doesNotMatch(sqlBody, /mise_actions/);
  assert.doesNotMatch(sqlBody, /operator_note/);
  assert.match(
    migration,
    /not ilike '%related_entity_id%'/,
    "must leave related_entity_id bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%title%'/,
    "must leave title bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%explanation%'/,
    "must leave explanation bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%dedupe_key%'/,
    "must leave dedupe_key bounds untouched"
  );
  assert.match(
    migration,
    /not ilike '%category%'/,
    "must leave category allowlist untouched"
  );
  assert.match(
    migration,
    /not ilike '%severity%'/,
    "must leave severity allowlist untouched"
  );
  assert.match(
    migration,
    /not ilike '%status%'/,
    "must leave status allowlist untouched"
  );
});

test("original operational_issues.related_entity_type had no CHECK; writers use short entity labels", () => {
  assert.match(
    original,
    /create table if not exists public\.operational_issues \([\s\S]*?status text not null default 'open' check \(status in \(\s*'open', 'monitoring', 'action_prepared', 'resolved', 'dismissed', 'expired'\s*\)\),\s*related_entity_type text,\s*related_entity_id text,/
  );
  assert.doesNotMatch(
    original,
    /create table if not exists public\.operational_issues \([\s\S]*?related_entity_type text[^\n]*check/
  );
  assert.match(
    original,
    /'inventory_item', new\.inventory_item_id::text/
  );
  assert.match(
    original,
    /nullif\(left\(trim\(p_related_entity_type\), 80\), ''\)/
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

  assert.match(pgTap, /related_entity_type collate "C" !~ ''\[\[:cntrl:\]\]''/);
  assert.match(
    pgTap,
    /length\\\(trim\\\(related_entity_type\\\)\\\) between 1 and 80/
  );
  assert.match(pgTap, /tab in operational related_entity_type is rejected/);
  assert.match(pgTap, /DEL in operational related_entity_type is rejected/);
});
