import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930070000_mise_005cs_restaurant_tasks_service_window_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_service_window_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CS pins restaurant_tasks service_window CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CS"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_service_window_check\s+check \(\s*service_window is null\s*or \(\s*service_window in \(\s*'before_lunch',\s*'before_prep',\s*'before_supplier_cutoff',\s*'before_dinner_service',\s*'during_closing',\s*'end_of_day',\s*'custom'\s*\)\s*and service_window collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`service_window collate "C" ~ '${TOKEN_PATTERN}'`),
    "service_window CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("service_window is null") &&
      migration.includes("'before_lunch'") &&
      migration.includes("'before_prep'") &&
      migration.includes("'before_supplier_cutoff'") &&
      migration.includes("'before_dinner_service'") &&
      migration.includes("'during_closing'") &&
      migration.includes("'end_of_day'") &&
      migration.includes("'custom'"),
    "nullable exact service_window allowlist must be preserved"
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
  assert.doesNotMatch(sqlBody, /restaurant_tasks_operational_category_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_verification_method_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_verification_check/i);
  assert.doesNotMatch(
    sqlBody,
    /drop constraint if exists restaurant_tasks_custom_window_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint restaurant_tasks_custom_window_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /drop constraint if exists restaurant_tasks_window_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint restaurant_tasks_window_check(?!_)/i
  );
  assert.doesNotMatch(sqlBody, /client_task_id/i);
  assert.doesNotMatch(sqlBody, /verification_method/i);
  assert.doesNotMatch(sqlBody, /operational_category/i);
  assert.doesNotMatch(sqlBody, /autonomy_configuration/i);
  assert.doesNotMatch(sqlBody, /pos_integrations/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
});

test("original restaurant_tasks service_window used bare nullable IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /service_window text check \(service_window is null or service_window in \(\s*'before_lunch', 'before_prep', 'before_supplier_cutoff',\s*'before_dinner_service', 'during_closing', 'end_of_day', 'custom'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /service_window collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_tasks service_window to COLLATE C", () => {
  assert.match(pgTap, /select plan\(16\)/);
  assert.match(pgTap, /restaurant_tasks_service_window_check exists/);
  assert.match(
    pgTap,
    /restaurant_tasks service_window CHECK remains nullable/
  );
  assert.match(
    pgTap,
    /restaurant_tasks service_window CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_tasks service_window CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token before_lunch matches under COLLATE C/);
  assert.match(pgTap, /writer token before_prep matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token before_supplier_cutoff matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer token before_dinner_service matches under COLLATE C/
  );
  assert.match(pgTap, /writer token during_closing matches under COLLATE C/);
  assert.match(pgTap, /writer token end_of_day matches under COLLATE C/);
  assert.match(pgTap, /writer token custom matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced service_window token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty service_window token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated service_window token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII service_window token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted service_window tokens match under COLLATE C/
  );
});
