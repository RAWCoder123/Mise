import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927140000_mise_005aq_purchase_decision_source_event_key_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalMemory = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_decision_source_event_key_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const KEY_PATTERN = "^[A-Za-z0-9:_-]{8,200}$";

test("MISE-005AQ pins purchase_decision source_event_key CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AQ"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_decision_events_source_event_key_check check \(\s*source_event_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{8,200\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`source_event_key collate "C" ~ '${KEY_PATTERN}'`),
    "source_event_key CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers or sibling pins.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.record_purchase_decision_base_event/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.record_purchase_decision_compensation/i
  );
  assert.doesNotMatch(
    sqlBody,
    /purchase_decision_events_recommendation_unit/i
  );
  assert.doesNotMatch(sqlBody, /purchase_lines_currency_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
  assert.doesNotMatch(sqlBody, /create or replace function private\.append_purchase_line/i);
  assert.doesNotMatch(sqlBody, /create or replace function public\.ingest_purchase_lines/i);
});

test("original purchase_decision source_event_key CHECK was length-only", () => {
  assert.match(
    originalMemory,
    /source_event_key text not null check \(length\(source_event_key\) between 8 and 200\)/
  );
  assert.doesNotMatch(
    originalMemory,
    /source_event_key collate "C" ~ '\^\[A-Za-z0-9:_-\]\{8,200\}\$'/
  );
  assert.match(
    originalMemory,
    /'audit_log:' \|\| p_source_audit_log_id::text/
  );
  assert.match(
    originalMemory,
    /'purchase_decision_exclusion:' \|\| target\.id::text/
  );
});

test("pgTAP fixture pins source_event_key shape to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /purchase_decision_events_source_event_key_check exists/);
  assert.match(
    pgTap,
    /purchase_decision_events source_event_key CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /purchase_decision_events source_event_key CHECK is not length-only/
  );
  assert.match(pgTap, /audit_log UUID source_event_key matches under COLLATE C/);
  assert.match(
    pgTap,
    /exclusion UUID source_event_key matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /hyphenated fixture source_event_key matches under COLLATE C/
  );
  assert.match(pgTap, /spaced source_event_key is rejected under COLLATE C/);
  assert.match(pgTap, /too-short source_event_key is rejected under COLLATE C/);
});
