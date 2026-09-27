import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927160000_mise_005as_recalculation_job_name_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260805120000_recalculation_run_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/recalculation_job_name_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const schedule = readFileSync(
  new URL("../services/domain/recalculationSchedule.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const JOB_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005AS pins recalculation_runs job_name CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AS"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint recalculation_runs_job_name_check check \(\s*job_name collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`job_name collate "C" ~ '${JOB_PATTERN}'`),
    "job_name CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.record_recalculation_run/i
  );
  assert.doesNotMatch(sqlBody, /recalculation_runs_cycle_key_check/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs_idempotency_key_check/i);
  assert.doesNotMatch(
    sqlBody,
    /purchase_decision_events_source_event_key_check/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /provider_connections_failure_code/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
});

test("original recalculation_runs job_name CHECK was length-only", () => {
  assert.match(
    originalLedger,
    /job_name text not null check \(length\(trim\(job_name\)\) between 1 and 80\)/
  );
  assert.doesNotMatch(
    originalLedger,
    /job_name collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );

  assert.match(schedule, /jobName: "recalculation\.daily_open"/);
  assert.match(schedule, /jobName: "recalculation\.mid_shift"/);
  assert.match(schedule, /jobName: "recalculation\.close"/);
});

test("pgTAP fixture pins recalculation job_name shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /recalculation_runs_job_name_check exists/);
  assert.match(pgTap, /recalculation_runs job_name CHECK uses COLLATE C/);
  assert.match(pgTap, /recalculation_runs job_name CHECK is not length-only/);
  assert.match(pgTap, /writer job_name daily_open matches under COLLATE C/);
  assert.match(pgTap, /writer job_name mid_shift matches under COLLATE C/);
  assert.match(pgTap, /writer job_name close matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced recalculation job_name is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty recalculation job_name is rejected under COLLATE C/
  );
});
