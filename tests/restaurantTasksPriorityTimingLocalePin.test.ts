import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930040000_mise_005cp_restaurant_tasks_priority_timing_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_priority_timing_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CP pins restaurant_tasks priority and timing_bucket CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CP"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_priority_check\s+check \(\s*priority in \('urgent', 'high', 'normal', 'low'\)\s*and priority collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_tasks_timing_bucket_check\s+check \(\s*timing_bucket in \('now', 'up_next', 'later'\)\s*and timing_bucket collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`priority collate "C" ~ '${TOKEN_PATTERN}'`),
    "priority CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`timing_bucket collate "C" ~ '${TOKEN_PATTERN}'`),
    "timing_bucket CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'urgent'") &&
      migration.includes("'high'") &&
      migration.includes("'normal'") &&
      migration.includes("'low'"),
    "exact priority allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'now'") &&
      migration.includes("'up_next'") &&
      migration.includes("'later'"),
    "exact timing_bucket allowlist must be preserved"
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
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /client_task_id/i);
  assert.doesNotMatch(sqlBody, /operational_category/i);
  assert.doesNotMatch(sqlBody, /verification_method/i);
  assert.doesNotMatch(sqlBody, /service_window/i);
  assert.doesNotMatch(sqlBody, /pos_integrations/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
});

test("original restaurant_tasks priority and timing_bucket used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /priority text not null default 'normal' check \(priority in \(\s*'urgent', 'high', 'normal', 'low'\s*\)\)/
  );
  assert.match(
    originalBound,
    /timing_bucket text not null default 'now' check \(timing_bucket in \(\s*'now', 'up_next', 'later'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /priority collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /timing_bucket collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_tasks priority and timing_bucket to COLLATE C", () => {
  assert.match(pgTap, /select plan\(23\)/);
  assert.match(pgTap, /restaurant_tasks_priority_check exists/);
  assert.match(pgTap, /restaurant_tasks priority CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurant_tasks priority CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_tasks_timing_bucket_check exists/);
  assert.match(
    pgTap,
    /restaurant_tasks timing_bucket CHECK keeps exact allowlist/
  );
  assert.match(pgTap, /restaurant_tasks timing_bucket CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token urgent matches under COLLATE C/);
  assert.match(pgTap, /writer token high matches under COLLATE C/);
  assert.match(pgTap, /writer token normal matches under COLLATE C/);
  assert.match(pgTap, /writer token low matches under COLLATE C/);
  assert.match(pgTap, /writer token now matches under COLLATE C/);
  assert.match(pgTap, /writer token up_next matches under COLLATE C/);
  assert.match(pgTap, /writer token later matches under COLLATE C/);
  assert.match(pgTap, /spaced priority token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced timing_bucket token is rejected under COLLATE C/);
  assert.match(pgTap, /empty priority token is rejected under COLLATE C/);
  assert.match(pgTap, /empty timing_bucket token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated priority token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated timing_bucket token is rejected under COLLATE C/
  );
  assert.match(pgTap, /non-ASCII priority token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /non-ASCII timing_bucket token is rejected under COLLATE C/
  );
  assert.match(pgTap, /all allowlisted priority tokens match under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted timing_bucket tokens match under COLLATE C/
  );
});
