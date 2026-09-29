import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930000000_mise_005cl_restaurant_tasks_status_locale_pin.sql",
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
    "../supabase/tests/database/restaurant_tasks_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CL pins restaurant_tasks status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint restaurant_tasks_status_check\s+check \(\s*status in \(\s*'waiting',\s*'blocked',\s*'in_progress',\s*'completed',\s*'cancelled',\s*'could_not_verify'\s*\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'waiting'") &&
      migration.includes("'blocked'") &&
      migration.includes("'in_progress'") &&
      migration.includes("'completed'") &&
      migration.includes("'cancelled'") &&
      migration.includes("'could_not_verify'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks_completion_check/i);
  assert.doesNotMatch(sqlBody, /create_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /complete_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /reopen_restaurant_task/i);
  assert.doesNotMatch(sqlBody, /client_task_id/i);
  assert.doesNotMatch(sqlBody, /supplier_orders/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions/i);
  assert.doesNotMatch(sqlBody, /recipe_versions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /completion_result/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_tasks[\s\S]*title/i);
});

test("original restaurant_tasks status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /status text not null default 'waiting' check \(status in \(\s*'waiting', 'blocked', 'in_progress', 'completed', 'cancelled',\s*'could_not_verify'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins restaurant_tasks status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(14\)/);
  assert.match(pgTap, /restaurant_tasks_status_check exists/);
  assert.match(pgTap, /restaurant_tasks status CHECK keeps exact allowlist/);
  assert.match(pgTap, /restaurant_tasks status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token waiting matches under COLLATE C/);
  assert.match(pgTap, /writer token blocked matches under COLLATE C/);
  assert.match(pgTap, /writer token in_progress matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /writer token cancelled matches under COLLATE C/);
  assert.match(pgTap, /writer token could_not_verify matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
