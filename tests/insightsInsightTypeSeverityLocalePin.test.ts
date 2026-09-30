import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930170000_mise_005dc_insights_insight_type_severity_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/insights_insight_type_severity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DC pins insights insight_type and severity CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint insights_insight_type_check\s+check \(\s*insight_type in \('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering'\)\s*and insight_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint insights_severity_check\s+check \(\s*severity in \('info', 'warning', 'urgent'\)\s*and severity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`insight_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "insight_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`severity collate "C" ~ '${TOKEN_PATTERN}'`),
    "severity CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'sales'") &&
      migration.includes("'inventory'") &&
      migration.includes("'waste'") &&
      migration.includes("'cost'") &&
      migration.includes("'prep'") &&
      migration.includes("'ordering'") &&
      migration.includes("'info'") &&
      migration.includes("'warning'") &&
      migration.includes("'urgent'"),
    "exact insight_type and severity allowlists must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_commit/i);
  assert.doesNotMatch(sqlBody, /insights_generation_source_check/i);
  assert.doesNotMatch(sqlBody, /planning_revision/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /\btitle\b/);
  assert.doesNotMatch(sqlBody, /\bdescription\b/);
  assert.doesNotMatch(sqlBody, /\brecommended_action\b/);
});

test("original insights insight_type and severity used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.insights[\s\S]*?insight_type text not null check \(insight_type in \('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering'\)\)[\s\S]*?severity text not null check \(severity in \('info', 'warning', 'urgent'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /insight_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /severity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins insights insight_type and severity to COLLATE C", () => {
  assert.match(pgTap, /select plan\(20\)/);
  assert.match(pgTap, /insights_insight_type_check exists/);
  assert.match(pgTap, /insights_severity_check exists/);
  assert.match(pgTap, /insights insight_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /insights insight_type CHECK uses COLLATE C/);
  assert.match(pgTap, /insights severity CHECK keeps exact allowlist/);
  assert.match(pgTap, /insights severity CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token sales matches under COLLATE C/);
  assert.match(pgTap, /writer token inventory matches under COLLATE C/);
  assert.match(pgTap, /writer token waste matches under COLLATE C/);
  assert.match(pgTap, /writer token cost matches under COLLATE C/);
  assert.match(pgTap, /writer token prep matches under COLLATE C/);
  assert.match(pgTap, /writer token ordering matches under COLLATE C/);
  assert.match(pgTap, /writer token info matches under COLLATE C/);
  assert.match(pgTap, /writer token warning matches under COLLATE C/);
  assert.match(pgTap, /writer token urgent matches under COLLATE C/);
  assert.match(pgTap, /spaced insight_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty insight vocabulary token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated severity token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII severity token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted insight_type and severity tokens match under COLLATE C/
  );
});
