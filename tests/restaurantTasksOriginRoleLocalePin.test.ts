import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930030000_mise_005co_restaurant_tasks_origin_role_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_origin_role_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CO pins restaurant_tasks origin and required_role CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CO"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_origin_check\s+check \(\s*origin in \('human', 'mise', 'automated', 'approval', 'verification'\)\s*and origin collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_tasks_required_role_check\s+check \(\s*required_role in \('member', 'manager', 'owner_admin'\)\s*and required_role collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`origin collate "C" ~ '${TOKEN_PATTERN}'`),
    "origin CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`required_role collate "C" ~ '${TOKEN_PATTERN}'`),
    "required_role CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'human'") &&
      migration.includes("'mise'") &&
      migration.includes("'automated'") &&
      migration.includes("'approval'") &&
      migration.includes("'verification'"),
    "exact origin allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'member'") &&
      migration.includes("'manager'") &&
      migration.includes("'owner_admin'"),
    "exact required_role allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /complete_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /reopen_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_status_check/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /client_task_id/i);
  assert.doesNotMatch(sqlBody, /timing_bucket/i);
  assert.doesNotMatch(sqlBody, /operational_category/i);
  assert.doesNotMatch(sqlBody, /verification_method/i);
  assert.doesNotMatch(sqlBody, /service_window/i);
  assert.doesNotMatch(sqlBody, /priority/i);
  assert.doesNotMatch(sqlBody, /pos_integrations/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
});

test("original restaurant_tasks origin and required_role used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /origin text not null default 'human' check \(origin in \(\s*'human', 'mise', 'automated', 'approval', 'verification'\s*\)\)/
  );
  assert.match(
    originalBound,
    /required_role text not null default 'member' check \(required_role in \(\s*'member', 'manager', 'owner_admin'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /origin collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /required_role collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_tasks origin and required_role to COLLATE C", () => {
  assert.match(pgTap, /select plan\(24\)/);
  assert.match(pgTap, /restaurant_tasks_origin_check exists/);
  assert.match(pgTap, /restaurant_tasks origin CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurant_tasks origin CHECK uses COLLATE C/);
  assert.match(pgTap, /restaurant_tasks_required_role_check exists/);
  assert.match(
    pgTap,
    /restaurant_tasks required_role CHECK keeps exact allowlist/
  );
  assert.match(pgTap, /restaurant_tasks required_role CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token human matches under COLLATE C/);
  assert.match(pgTap, /writer token mise matches under COLLATE C/);
  assert.match(pgTap, /writer token automated matches under COLLATE C/);
  assert.match(pgTap, /writer token approval matches under COLLATE C/);
  assert.match(pgTap, /writer token verification matches under COLLATE C/);
  assert.match(pgTap, /writer token member matches under COLLATE C/);
  assert.match(pgTap, /writer token manager matches under COLLATE C/);
  assert.match(pgTap, /writer token owner_admin matches under COLLATE C/);
  assert.match(pgTap, /spaced origin token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced required_role token is rejected under COLLATE C/);
  assert.match(pgTap, /empty origin token is rejected under COLLATE C/);
  assert.match(pgTap, /empty required_role token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated origin token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated required_role token is rejected under COLLATE C/
  );
  assert.match(pgTap, /non-ASCII origin token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /non-ASCII required_role token is rejected under COLLATE C/
  );
  assert.match(pgTap, /all allowlisted origin tokens match under COLLATE C/);
  assert.match(
    pgTap,
    /all allowlisted required_role tokens match under COLLATE C/
  );
});
