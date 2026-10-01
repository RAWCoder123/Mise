import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sanitizeRecalculationFailureReason } from "../services/domain/recalculationSchedule";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001210000_mise_005eq_recalculation_failure_reason_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260805120000_recalculation_run_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/recalculationSchedule.ts", import.meta.url),
  "utf8"
);
const cycles = readFileSync(
  new URL("../services/application/recalculationCycles.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/recalculation_failure_reason_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

test("MISE-005EQ pins recalculation_runs.failure_reason CHECK to COLLATE C cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005EQ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint recalculation_runs_failure_reason_check check \(\s*failure_reason is null\s*or \(\s*length\(trim\(failure_reason\)\) between 1 and 200\s*and failure_reason collate "C" !~ '\[\[:cntrl:\]\]'\s*\)\s*\)/
  );

  assert.ok(
    migration.includes(`failure_reason collate "C" !~ '[[:cntrl:]]'`),
    "failure_reason CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("length(trim(failure_reason)) between 1 and 200"),
    "exact failure_reason length bound must be preserved"
  );
  assert.ok(migration.includes("failure_reason is null"), "nullability must be preserved");

  // Compose: CHECK-only. Do not rewrite writers or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /record_recalculation_run/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs_status_check/i);
  // May name recalculation_runs_failure_check only as a drop-exclusion guard.
  assert.doesNotMatch(
    sqlBody,
    /drop constraint(?: if exists)? recalculation_runs_failure_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /add constraint recalculation_runs_failure_check/i
  );
  assert.match(
    migration,
    /con\.conname <> 'recalculation_runs_failure_check'/,
    "must leave the status/reason consistency CHECK untouched"
  );
  assert.doesNotMatch(sqlBody, /job_name/i);
  assert.doesNotMatch(sqlBody, /cycle_key/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /monitoring_owner/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
});

test("original recalculation_runs.failure_reason CHECK had length only without cntrl gate", () => {
  assert.match(
    original,
    /failure_reason text check \(failure_reason is null or length\(trim\(failure_reason\)\) between 1 and 200\)/
  );
  assert.doesNotMatch(
    original,
    /failure_reason text check \(failure_reason is null or length\(trim\(failure_reason\)\) between 1 and 200\)[\s\S]{0,80}\[\[:cntrl:\]\]/
  );
});

test("sanitizeRecalculationFailureReason strips ASCII C control characters", () => {
  assert.equal(
    sanitizeRecalculationFailureReason(" timeout exceeded "),
    "timeout exceeded"
  );
  assert.equal(sanitizeRecalculationFailureReason(null), null);
  assert.equal(sanitizeRecalculationFailureReason(""), null);
  assert.equal(
    sanitizeRecalculationFailureReason("timeout\texceeded"),
    "timeout exceeded"
  );
  assert.equal(
    sanitizeRecalculationFailureReason("timeout\nexceeded"),
    "timeout exceeded"
  );
  assert.equal(
    sanitizeRecalculationFailureReason("timeout\u007fexceeded"),
    "timeout exceeded"
  );
  assert.equal(
    sanitizeRecalculationFailureReason("\t\n\u007f"),
    null
  );
  assert.equal(
    sanitizeRecalculationFailureReason("A".repeat(250))?.length,
    200
  );
  assert.match(
    domain,
    /export function sanitizeRecalculationFailureReason[\s\S]*\[\\u0000-\\u001f\\u007f\]/
  );
  assert.match(
    cycles,
    /sanitizeRecalculationFailureReason/
  );
});

test("pgTAP fixture pins recalculation_runs.failure_reason to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /recalculation_runs_failure_reason_check exists/);
  assert.match(
    pgTap,
    /recalculation_runs_failure_check consistency constraint remains/
  );
  assert.match(pgTap, /recalculation_runs failure_reason CHECK keeps exact length bound/);
  assert.match(
    pgTap,
    /recalculation_runs failure_reason CHECK uses COLLATE C cntrl rejection/
  );
  assert.match(pgTap, /recalculation_runs failure_reason CHECK keeps nullability/);
  assert.match(pgTap, /printable failure reason is accepted under COLLATE C/);
  assert.match(pgTap, /tab in failure reason is rejected under COLLATE C/);
  assert.match(pgTap, /newline in failure reason is rejected under COLLATE C/);
  assert.match(pgTap, /DEL in failure reason is rejected under COLLATE C/);
  assert.match(pgTap, /empty string has no control characters under COLLATE C/);
  assert.match(
    pgTap,
    /failure reason control detector matches ASCII C \[\[:cntrl:\]\]/
  );
  assert.match(
    pgTap,
    /ASCII control detector is identical under C and under the database ctype/
  );
});
