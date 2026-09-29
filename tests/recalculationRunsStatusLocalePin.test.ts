import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929220000_mise_005cj_recalculation_runs_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260805120000_recalculation_run_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/recalculation_runs_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CJ pins recalculation_runs status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CJ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint recalculation_runs_status_check\s+check \(\s*status in \('succeeded', 'failed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'succeeded'") && migration.includes("'failed'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs_failure_check/i);
  assert.doesNotMatch(sqlBody, /record_recalculation_run/i);
  assert.doesNotMatch(sqlBody, /cycle_key/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /job_name/i);
  assert.doesNotMatch(sqlBody, /monitoring_owner/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions/i);
  assert.doesNotMatch(sqlBody, /recipe_versions/i);
  assert.doesNotMatch(sqlBody, /supplier_orders/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
});

test("original recalculation_runs status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.recalculation_runs[\s\S]*?status text not null check \(status in \('succeeded', 'failed'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins recalculation_runs status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /recalculation_runs_status_check exists/);
  assert.match(pgTap, /recalculation_runs status CHECK keeps exact allowlist/);
  assert.match(pgTap, /recalculation_runs status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token succeeded matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
