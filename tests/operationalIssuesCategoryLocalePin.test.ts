import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930090000_mise_005cu_operational_issues_category_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_issues_category_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CU pins operational_issues category CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_issues_category_check\s+check \(\s*category in \(\s*'inventory',\s*'orders',\s*'sales',\s*'team',\s*'waste',\s*'integrations',\s*'tasks',\s*'system'\s*\)\s*and category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`category collate "C" ~ '${TOKEN_PATTERN}'`),
    "category CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'inventory'") &&
      migration.includes("'orders'") &&
      migration.includes("'sales'") &&
      migration.includes("'team'") &&
      migration.includes("'waste'") &&
      migration.includes("'integrations'") &&
      migration.includes("'tasks'") &&
      migration.includes("'system'"),
    "exact category allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /operational_issues_severity_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_status_check/i);
  assert.doesNotMatch(sqlBody, /operational_issues_dedupe_key_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_autonomy_rules/i);
  assert.doesNotMatch(sqlBody, /restaurant_autonomy_rules_operational_category_check/i);
  assert.doesNotMatch(sqlBody, /severity in/i);
  assert.doesNotMatch(sqlBody, /status in/i);
});

test("original operational_issues category used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /category text not null check \(category in \(\s*'inventory', 'orders', 'sales', 'team', 'waste', 'integrations', 'tasks', 'system'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins operational_issues category to COLLATE C", () => {
  assert.match(pgTap, /select plan\(16\)/);
  assert.match(pgTap, /operational_issues_category_check exists/);
  assert.match(pgTap, /operational_issues category CHECK keeps exact allowlist/);
  assert.match(pgTap, /operational_issues category CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token inventory matches under COLLATE C/);
  assert.match(pgTap, /writer token orders matches under COLLATE C/);
  assert.match(pgTap, /writer token sales matches under COLLATE C/);
  assert.match(pgTap, /writer token team matches under COLLATE C/);
  assert.match(pgTap, /writer token waste matches under COLLATE C/);
  assert.match(pgTap, /writer token integrations matches under COLLATE C/);
  assert.match(pgTap, /writer token tasks matches under COLLATE C/);
  assert.match(pgTap, /writer token system matches under COLLATE C/);
  assert.match(pgTap, /spaced category token is rejected under COLLATE C/);
  assert.match(pgTap, /empty category token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated category token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII category token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted category tokens match under COLLATE C/);
});
