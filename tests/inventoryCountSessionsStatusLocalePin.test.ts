import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929210000_mise_005ci_inventory_count_sessions_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260810140000_inventory_count_sessions_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/inventory_count_sessions_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CI pins inventory_count_sessions status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CI"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_count_sessions_status_check\s+check \(\s*status in \('in_progress', 'submitted', 'approved', 'cancelled'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'in_progress'") &&
      migration.includes("'submitted'") &&
      migration.includes("'approved'") &&
      migration.includes("'cancelled'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions_submitted_consistency/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions_approved_consistency/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions_cancelled_consistency/i);
  assert.doesNotMatch(sqlBody, /recipe_versions_status_check/i);
  assert.doesNotMatch(sqlBody, /verification_status/i);
  assert.doesNotMatch(sqlBody, /inventory_events_event_type_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.recipe_versions/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /supplier_orders/i);
});

test("original inventory_count_sessions status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.inventory_count_sessions[\s\S]*?status text not null check \(status in \('in_progress', 'submitted', 'approved', 'cancelled'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins inventory_count_sessions status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /inventory_count_sessions_status_check exists/);
  assert.match(pgTap, /inventory_count_sessions status CHECK keeps exact allowlist/);
  assert.match(pgTap, /inventory_count_sessions status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token in_progress matches under COLLATE C/);
  assert.match(pgTap, /writer token submitted matches under COLLATE C/);
  assert.match(pgTap, /writer token approved matches under COLLATE C/);
  assert.match(pgTap, /writer token cancelled matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
