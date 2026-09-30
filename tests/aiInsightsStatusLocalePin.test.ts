import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930220000_mise_005dh_ai_insights_status_locale_pin.sql",
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
    "../supabase/tests/database/ai_insights_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DH pins ai_insights status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint ai_insights_status_check\s+check \(\s*status in \('generated', 'reviewed', 'dismissed', 'applied'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'generated'") &&
      migration.includes("'reviewed'") &&
      migration.includes("'dismissed'") &&
      migration.includes("'applied'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /ai_insights_server_provenance_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_schema_version/i);
  assert.doesNotMatch(sqlBody, /ai_insights_output_bounds_check/i);
  assert.doesNotMatch(sqlBody, /ai_insights_risk_level/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.insights/i);
  assert.doesNotMatch(sqlBody, /service_create_rules_engine_ai_insight/i);
});

test("original ai_insights status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.ai_insights[\s\S]*?status text not null default 'generated' check \(status in \('generated', 'reviewed', 'dismissed', 'applied'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins ai_insights status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /ai_insights_status_check exists/);
  assert.match(pgTap, /ai_insights status CHECK keeps exact allowlist/);
  assert.match(pgTap, /ai_insights status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token generated matches under COLLATE C/);
  assert.match(pgTap, /writer token reviewed matches under COLLATE C/);
  assert.match(pgTap, /writer token dismissed matches under COLLATE C/);
  assert.match(pgTap, /writer token applied matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
