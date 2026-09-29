import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930050000_mise_005cq_restaurant_tasks_operational_category_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260802222329_shared_restaurant_tasks.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/restaurant_tasks_operational_category_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CQ pins restaurant_tasks operational_category CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CQ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_operational_category_check\s+check \(\s*operational_category in \(\s*'inventory',\s*'orders',\s*'prep',\s*'service',\s*'team',\s*'cleaning',\s*'maintenance',\s*'deliveries',\s*'closing',\s*'integrations',\s*'other'\s*\)\s*and operational_category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`operational_category collate "C" ~ '${TOKEN_PATTERN}'`),
    "operational_category CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'inventory'") &&
      migration.includes("'orders'") &&
      migration.includes("'prep'") &&
      migration.includes("'service'") &&
      migration.includes("'team'") &&
      migration.includes("'cleaning'") &&
      migration.includes("'maintenance'") &&
      migration.includes("'deliveries'") &&
      migration.includes("'closing'") &&
      migration.includes("'integrations'") &&
      migration.includes("'other'"),
    "exact operational_category allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /complete_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /reopen_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_status_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_origin_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_required_role_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_priority_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_timing_bucket_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /client_task_id/i);
  assert.doesNotMatch(sqlBody, /verification_method/i);
  assert.doesNotMatch(sqlBody, /service_window/i);
  assert.doesNotMatch(sqlBody, /autonomy_configuration/i);
  assert.doesNotMatch(sqlBody, /pos_integrations/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
});

test("original restaurant_tasks operational_category used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /operational_category text not null default 'other' check \(operational_category in \(\s*'inventory', 'orders', 'prep', 'service', 'team', 'cleaning',\s*'maintenance', 'deliveries', 'closing', 'integrations', 'other'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /operational_category collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_tasks operational_category to COLLATE C", () => {
  assert.match(pgTap, /select plan\(19\)/);
  assert.match(pgTap, /restaurant_tasks_operational_category_check exists/);
  assert.match(
    pgTap,
    /restaurant_tasks operational_category CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_tasks operational_category CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token inventory matches under COLLATE C/);
  assert.match(pgTap, /writer token orders matches under COLLATE C/);
  assert.match(pgTap, /writer token prep matches under COLLATE C/);
  assert.match(pgTap, /writer token service matches under COLLATE C/);
  assert.match(pgTap, /writer token team matches under COLLATE C/);
  assert.match(pgTap, /writer token cleaning matches under COLLATE C/);
  assert.match(pgTap, /writer token maintenance matches under COLLATE C/);
  assert.match(pgTap, /writer token deliveries matches under COLLATE C/);
  assert.match(pgTap, /writer token closing matches under COLLATE C/);
  assert.match(pgTap, /writer token integrations matches under COLLATE C/);
  assert.match(pgTap, /writer token other matches under COLLATE C/);
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
