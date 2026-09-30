import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930240000_mise_005dj_ai_insights_source_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ai_insights_source_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DJ pins ai_insights source CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint ai_insights_source_check\s+check \(\s*source in \('openai_structured_output', 'rules_engine', 'operator_note'\)\s*and source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`source collate "C" ~ '${TOKEN_PATTERN}'`),
    "source CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'openai_structured_output'") &&
      migration.includes("'rules_engine'") &&
      migration.includes("'operator_note'"),
    "exact source allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /ai_insights_server_provenance_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_schema_version/i);
  assert.doesNotMatch(sqlBody, /ai_insights_output_bounds_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_status_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_risk_level_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /service_create_rules_engine_ai_insight/i);
});

test("original ai_insights source used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.ai_insights[\s\S]*?source text not null default 'rules_engine' check \(source in \('openai_structured_output', 'rules_engine', 'operator_note'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins ai_insights source to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /ai_insights_source_check exists/);
  assert.match(pgTap, /ai_insights source CHECK keeps exact allowlist/);
  assert.match(pgTap, /ai_insights source CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token openai_structured_output matches under COLLATE C/);
  assert.match(pgTap, /writer token rules_engine matches under COLLATE C/);
  assert.match(pgTap, /writer token operator_note matches under COLLATE C/);
  assert.match(pgTap, /spaced source token is rejected under COLLATE C/);
  assert.match(pgTap, /empty source token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated source token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII source token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted source tokens match under COLLATE C/);
});
