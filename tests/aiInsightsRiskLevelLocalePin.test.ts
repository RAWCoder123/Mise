import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930230000_mise_005di_ai_insights_risk_level_locale_pin.sql",
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
    "../supabase/tests/database/ai_insights_risk_level_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DI pins ai_insights risk_level CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DI"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint ai_insights_risk_level_check\s+check \(\s*risk_level in \('low', 'medium', 'high'\)\s*and risk_level collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`risk_level collate "C" ~ '${TOKEN_PATTERN}'`),
    "risk_level CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'low'") &&
      migration.includes("'medium'") &&
      migration.includes("'high'"),
    "exact risk_level allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /ai_insights_server_provenance_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_schema_version/i);
  assert.doesNotMatch(sqlBody, /ai_insights_output_bounds_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_status_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /service_create_rules_engine_ai_insight/i);
});

test("original ai_insights risk_level used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.ai_insights[\s\S]*?risk_level text not null default 'low' check \(risk_level in \('low', 'medium', 'high'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /risk_level collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins ai_insights risk_level to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /ai_insights_risk_level_check exists/);
  assert.match(pgTap, /ai_insights risk_level CHECK keeps exact allowlist/);
  assert.match(pgTap, /ai_insights risk_level CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token low matches under COLLATE C/);
  assert.match(pgTap, /writer token medium matches under COLLATE C/);
  assert.match(pgTap, /writer token high matches under COLLATE C/);
  assert.match(pgTap, /spaced risk_level token is rejected under COLLATE C/);
  assert.match(pgTap, /empty risk_level token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated risk_level token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII risk_level token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted risk_level tokens match under COLLATE C/);
});
