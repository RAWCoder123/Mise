import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927150000_mise_005ar_recalculation_run_key_locale_pin.sql",
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
    "../supabase/tests/database/recalculation_run_key_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const ports = readFileSync(
  new URL("../services/application/recalculationPorts.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const KEY_PATTERN = "^[A-Za-z0-9:_-]{1,240}$";

test("MISE-005AR pins recalculation_runs key CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AR"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint recalculation_runs_cycle_key_check check \(\s*cycle_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint recalculation_runs_idempotency_key_check check \(\s*idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`cycle_key collate "C" ~ '${KEY_PATTERN}'`),
    "cycle_key CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`idempotency_key collate "C" ~ '${KEY_PATTERN}'`),
    "idempotency_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.record_recalculation_run/i
  );
  assert.doesNotMatch(
    sqlBody,
    /purchase_decision_events_source_event_key_check/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /provider_connections_failure_code/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
});

test("original recalculation_runs key CHECKs were length-only", () => {
  assert.match(
    originalLedger,
    /cycle_key text not null check \(length\(trim\(cycle_key\)\) between 1 and 240\)/
  );
  assert.match(
    originalLedger,
    /idempotency_key text not null check \(length\(trim\(idempotency_key\)\) between 1 and 240\)/
  );
  assert.doesNotMatch(
    originalLedger,
    /cycle_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'/
  );
  assert.doesNotMatch(
    originalLedger,
    /idempotency_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{1,240\}\$'/
  );

  assert.match(
    ports,
    /const cycleKey = `recalc:\$\{record\.restaurantId\}:\$\{record\.operatingDate\}:\$\{record\.cycle\}`/
  );
  assert.match(
    ports,
    /idempotencyKey: `\$\{cycleKey\}:attempt-\$\{record\.attempt\}`/
  );
});

test("pgTAP fixture pins recalculation key shapes to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /recalculation_runs_cycle_key_check exists/);
  assert.match(pgTap, /recalculation_runs_idempotency_key_check exists/);
  assert.match(pgTap, /recalculation_runs cycle_key CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /recalculation_runs idempotency_key CHECK uses COLLATE C/
  );
  assert.match(pgTap, /recalculation_runs cycle_key CHECK is not length-only/);
  assert.match(
    pgTap,
    /recalculation_runs idempotency_key CHECK is not length-only/
  );
  assert.match(pgTap, /writer cycle_key matches under COLLATE C/);
  assert.match(pgTap, /writer idempotency_key matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced recalculation key is rejected under COLLATE C/
  );
  assert.match(pgTap, /empty recalculation key is rejected under COLLATE C/);
});
