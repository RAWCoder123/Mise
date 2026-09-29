import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929200000_mise_005ch_recipe_versions_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260726195018_operational_data_foundation_inventory_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/recipe_versions_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CH pins recipe_versions status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CH"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint recipe_versions_status_check\s+check \(\s*status in \('draft', 'verified', 'retired'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'draft'") &&
      migration.includes("'verified'") &&
      migration.includes("'retired'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /recipe_versions_no_overlapping_active_windows/i);
  assert.doesNotMatch(sqlBody, /verification_status/i);
  assert.doesNotMatch(sqlBody, /inventory_events_event_type_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.inventory_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /external_catalog_item_id/i);
  assert.doesNotMatch(sqlBody, /external_modifier_id/i);
});

test("original recipe_versions status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.recipe_versions[\s\S]*?status text not null default 'draft' check \(status in \('draft', 'verified', 'retired'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins recipe_versions status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /recipe_versions_status_check exists/);
  assert.match(pgTap, /recipe_versions status CHECK keeps exact allowlist/);
  assert.match(pgTap, /recipe_versions status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token draft matches under COLLATE C/);
  assert.match(pgTap, /writer token verified matches under COLLATE C/);
  assert.match(pgTap, /writer token retired matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
