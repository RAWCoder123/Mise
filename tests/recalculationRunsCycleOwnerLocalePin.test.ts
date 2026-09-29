import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930010000_mise_005cm_recalculation_runs_cycle_owner_locale_pin.sql",
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
    "../supabase/tests/database/recalculation_runs_cycle_owner_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CM pins recalculation_runs cycle and monitoring_owner CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CM"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint recalculation_runs_cycle_check\s+check \(\s*cycle in \('daily_open', 'mid_shift', 'close'\)\s*and cycle collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint recalculation_runs_monitoring_owner_check\s+check \(\s*monitoring_owner in \('member', 'manager', 'owner_admin'\)\s*and monitoring_owner collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`cycle collate "C" ~ '${TOKEN_PATTERN}'`),
    "cycle CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`monitoring_owner collate "C" ~ '${TOKEN_PATTERN}'`),
    "monitoring_owner CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'daily_open'") &&
      migration.includes("'mid_shift'") &&
      migration.includes("'close'"),
    "exact cycle allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'member'") &&
      migration.includes("'manager'") &&
      migration.includes("'owner_admin'"),
    "exact monitoring_owner allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs_failure_check/i);
  assert.doesNotMatch(sqlBody, /record_recalculation_run/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs_status_check/i);
  assert.doesNotMatch(sqlBody, /cycle_key/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /job_name/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions/i);
  assert.doesNotMatch(sqlBody, /recipe_versions/i);
  assert.doesNotMatch(sqlBody, /supplier_orders/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
});

test("original recalculation_runs cycle and monitoring_owner used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.recalculation_runs[\s\S]*?cycle text not null check \(cycle in \('daily_open', 'mid_shift', 'close'\)\)/
  );
  assert.match(
    originalBound,
    /monitoring_owner text not null check \(monitoring_owner in \('member', 'manager', 'owner_admin'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /cycle collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /monitoring_owner collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins recalculation_runs cycle and monitoring_owner to COLLATE C", () => {
  assert.match(pgTap, /select plan\(22\)/);
  assert.match(pgTap, /recalculation_runs_cycle_check exists/);
  assert.match(pgTap, /recalculation_runs cycle CHECK keeps exact allowlist/);
  assert.match(pgTap, /recalculation_runs cycle CHECK uses COLLATE C/);
  assert.match(pgTap, /recalculation_runs_monitoring_owner_check exists/);
  assert.match(pgTap, /recalculation_runs monitoring_owner CHECK keeps exact allowlist/);
  assert.match(pgTap, /recalculation_runs monitoring_owner CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token daily_open matches under COLLATE C/);
  assert.match(pgTap, /writer token mid_shift matches under COLLATE C/);
  assert.match(pgTap, /writer token close matches under COLLATE C/);
  assert.match(pgTap, /writer token member matches under COLLATE C/);
  assert.match(pgTap, /writer token manager matches under COLLATE C/);
  assert.match(pgTap, /writer token owner_admin matches under COLLATE C/);
  assert.match(pgTap, /spaced cycle token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced monitoring_owner token is rejected under COLLATE C/);
  assert.match(pgTap, /empty cycle token is rejected under COLLATE C/);
  assert.match(pgTap, /empty monitoring_owner token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated cycle token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated monitoring_owner token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII cycle token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII monitoring_owner token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted cycle tokens match under COLLATE C/);
  assert.match(pgTap, /all allowlisted monitoring_owner tokens match under COLLATE C/);
});
