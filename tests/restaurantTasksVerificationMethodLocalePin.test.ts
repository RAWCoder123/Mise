import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930060000_mise_005cr_restaurant_tasks_verification_method_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_verification_method_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CR pins restaurant_tasks verification_method CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CR"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_verification_method_check\s+check \(\s*verification_method in \(\s*'none',\s*'checklist',\s*'photo',\s*'count',\s*'receipt',\s*'manager_review',\s*'source_state'\s*\)\s*and verification_method collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`verification_method collate "C" ~ '${TOKEN_PATTERN}'`),
    "verification_method CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'none'") &&
      migration.includes("'checklist'") &&
      migration.includes("'photo'") &&
      migration.includes("'count'") &&
      migration.includes("'receipt'") &&
      migration.includes("'manager_review'") &&
      migration.includes("'source_state'"),
    "exact verification_method allowlist must be preserved"
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
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_verification_check/i);
  assert.doesNotMatch(sqlBody, /client_task_id/i);
  assert.doesNotMatch(sqlBody, /service_window/i);
  assert.doesNotMatch(sqlBody, /operational_category/i);
  assert.doesNotMatch(sqlBody, /autonomy_configuration/i);
  assert.doesNotMatch(sqlBody, /pos_integrations/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
});

test("original restaurant_tasks verification_method used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /verification_method text not null default 'none' check \(verification_method in \(\s*'none', 'checklist', 'photo', 'count', 'receipt', 'manager_review',\s*'source_state'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /verification_method collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_tasks verification_method to COLLATE C", () => {
  assert.match(pgTap, /select plan\(15\)/);
  assert.match(pgTap, /restaurant_tasks_verification_method_check exists/);
  assert.match(
    pgTap,
    /restaurant_tasks verification_method CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_tasks verification_method CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token none matches under COLLATE C/);
  assert.match(pgTap, /writer token checklist matches under COLLATE C/);
  assert.match(pgTap, /writer token photo matches under COLLATE C/);
  assert.match(pgTap, /writer token count matches under COLLATE C/);
  assert.match(pgTap, /writer token receipt matches under COLLATE C/);
  assert.match(pgTap, /writer token manager_review matches under COLLATE C/);
  assert.match(pgTap, /writer token source_state matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced verification_method token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty verification_method token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated verification_method token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII verification_method token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted verification_method tokens match under COLLATE C/
  );
});
