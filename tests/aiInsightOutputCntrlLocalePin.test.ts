import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004220000_mise_005hj_ai_insight_output_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalFoundation = readFileSync(
  new URL(
    "../supabase/migrations/20260715164843_harden_profile_ai_and_order_boundaries.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ai_insight_output_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005HJ pins structured_ai_insight_output_is_valid cntrl and allowlists to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005HJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /create or replace function private\.structured_ai_insight_output_is_valid\(p_output jsonb\)/i
  );
  assert.ok(
    migration.includes(`title_text collate "C" ~ '[[:cntrl:]]'`),
    "title must reject controls under COLLATE C"
  );
  assert.ok(
    migration.includes(`summary_text collate "C" ~ '[[:cntrl:]]'`),
    "summary must reject controls under COLLATE C"
  );
  assert.ok(
    migration.includes(`action_text collate "C" ~ '[[:cntrl:]]'`),
    "recommended_action must reject controls under COLLATE C"
  );
  assert.ok(
    migration.includes(`evidence_text collate "C" ~ '[[:cntrl:]]'`),
    "evidence lines must reject controls under COLLATE C"
  );
  assert.match(
    migration,
    /risk_text collate "C" not in \('low', 'medium', 'high'\)/
  );
  assert.match(
    migration,
    /workflow_text collate "C" not in \(\s*'inventory', 'ordering', 'prep', 'sales', 'waste', 'cost'\s*\)/
  );
  assert.match(
    migration,
    /grant execute on function private\.structured_ai_insight_output_is_valid\(jsonb\)\s*to service_role/i
  );
  assert.match(
    migration,
    /revoke all on function private\.structured_ai_insight_output_is_valid\(jsonb\)\s*from public, anon, authenticated, service_role/i
  );

  // Compose: validator-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_create_rules_engine_ai_insight/i
  );
  assert.doesNotMatch(sqlBody, /ai_insights_schema_version_length_check/);
  assert.doesNotMatch(sqlBody, /ai_insights_server_provenance_check/);
  assert.doesNotMatch(sqlBody, /insights_content_bounds_check/);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
});

test("original structured AI insight validator used length-only text and bare allowlists", () => {
  const start = originalFoundation.indexOf(
    "create or replace function private.structured_ai_insight_output_is_valid(p_output jsonb)"
  );
  assert.ok(start >= 0, "foundation validator must exist");
  const end = originalFoundation.indexOf(
    "revoke all on function private.structured_ai_insight_output_is_valid",
    start
  );
  assert.ok(end > start, "foundation revoke must follow validator");
  const body = originalFoundation.slice(start, end);

  assert.match(body, /pg_catalog\.length\(p_output ->> 'title'\) not between 1 and 96/);
  assert.match(
    body,
    /p_output ->> 'risk_level' not in \('low', 'medium', 'high'\)/
  );
  assert.match(
    body,
    /p_output ->> 'affected_workflow' not in \('inventory', 'ordering', 'prep', 'sales', 'waste', 'cost'\)/
  );
  assert.doesNotMatch(body, /collate "C"/);
  assert.doesNotMatch(body, /\[\[:cntrl:\]\]/);
});

test("length+cntrl class matches the pinned structured insight text contract", () => {
  const isAllowedInsightText = (value: string, max: number) => {
    return (
      value.length >= 1 &&
      value.length <= max &&
      !/[\u0000-\u001f\u007f]/.test(value)
    );
  };
  const isAllowedRisk = (value: string) =>
    ["low", "medium", "high"].includes(value);
  const isAllowedWorkflow = (value: string) =>
    ["inventory", "ordering", "prep", "sales", "waste", "cost"].includes(value);

  assert.equal(isAllowedInsightText("Low bun stock", 96), true);
  assert.equal(isAllowedInsightText("a".repeat(96), 96), true);
  assert.equal(isAllowedInsightText("a".repeat(97), 96), false);
  assert.equal(isAllowedInsightText("", 96), false);
  assert.equal(isAllowedInsightText("Low\tbun", 96), false);
  assert.equal(isAllowedInsightText("Low\nbun", 96), false);
  assert.equal(isAllowedInsightText("Low\u007fbun", 96), false);
  assert.equal(isAllowedRisk("medium"), true);
  assert.equal(isAllowedRisk("MEDIUM"), false);
  assert.equal(isAllowedWorkflow("inventory"), true);
  assert.equal(isAllowedWorkflow("Inventory"), false);
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

  assert.match(pgTap, /title_text collate "C" ~ ''\[\[:cntrl:\]\]''/);
  assert.match(pgTap, /risk_text collate "C" not in/);
  assert.match(pgTap, /workflow_text collate "C" not in/);
  assert.match(pgTap, /tab in insight title is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in insight evidence is rejected under COLLATE C/);
  assert.match(pgTap, /risk_level allowlist stays pinned under COLLATE C/);
});
