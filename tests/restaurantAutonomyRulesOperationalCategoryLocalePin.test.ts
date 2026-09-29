import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930080000_mise_005ct_restaurant_autonomy_rules_operational_category_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_autonomy_rules_operational_category_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CT pins restaurant_autonomy_rules operational_category CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CT"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_autonomy_rules_operational_category_check\s+check \(\s*operational_category in \(\s*'inventory',\s*'orders',\s*'sales',\s*'team',\s*'waste',\s*'tasks',\s*'integrations',\s*'settings'\s*\)\s*and operational_category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`operational_category collate "C" ~ '${TOKEN_PATTERN}'`),
    "operational_category CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'inventory'") &&
      migration.includes("'orders'") &&
      migration.includes("'sales'") &&
      migration.includes("'team'") &&
      migration.includes("'waste'") &&
      migration.includes("'tasks'") &&
      migration.includes("'integrations'") &&
      migration.includes("'settings'"),
    "exact operational_category allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /upsert_restaurant_autonomy_rule/i);
  assert.doesNotMatch(sqlBody, /restaurant_autonomy_rules_execute_guard/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_operational_category_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /alter table public\.operational_issues/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /action_type/i);
  assert.doesNotMatch(sqlBody, /supplier_name/i);
  assert.doesNotMatch(sqlBody, /communication_type/i);
  assert.doesNotMatch(sqlBody, /pos_integrations/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
});

test("original restaurant_autonomy_rules operational_category used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /operational_category text not null check \(operational_category in \(\s*'inventory', 'orders', 'sales', 'team', 'waste', 'tasks', 'integrations', 'settings'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /operational_category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_autonomy_rules operational_category to COLLATE C", () => {
  assert.match(pgTap, /select plan\(16\)/);
  assert.match(pgTap, /restaurant_autonomy_rules_operational_category_check exists/);
  assert.match(
    pgTap,
    /restaurant_autonomy_rules operational_category CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_autonomy_rules operational_category CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token inventory matches under COLLATE C/);
  assert.match(pgTap, /writer token orders matches under COLLATE C/);
  assert.match(pgTap, /writer token sales matches under COLLATE C/);
  assert.match(pgTap, /writer token team matches under COLLATE C/);
  assert.match(pgTap, /writer token waste matches under COLLATE C/);
  assert.match(pgTap, /writer token tasks matches under COLLATE C/);
  assert.match(pgTap, /writer token integrations matches under COLLATE C/);
  assert.match(pgTap, /writer token settings matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced operational_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty operational_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated operational_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII operational_category token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted operational_category tokens match under COLLATE C/
  );
});
