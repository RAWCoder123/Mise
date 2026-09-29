import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929180000_mise_005cf_inventory_event_type_locale_pin.sql",
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
    "../supabase/tests/database/inventory_event_type_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CF pins inventory_events event_type CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint inventory_events_event_type_check check \(\s*event_type in \(\s*'receipt',\s*'count',\s*'waste',\s*'stockout',\s*'usage',\s*'adjustment',\s*'transfer',\s*'correction'\s*\)\s*and event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`event_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "event_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'receipt'") &&
      migration.includes("'count'") &&
      migration.includes("'waste'") &&
      migration.includes("'stockout'") &&
      migration.includes("'usage'") &&
      migration.includes("'adjustment'") &&
      migration.includes("'transfer'") &&
      migration.includes("'correction'"),
    "exact event_type allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested inventory_events stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /append_inventory_event/i);
  assert.doesNotMatch(sqlBody, /inventory_event_quantity_check/i);
  assert.doesNotMatch(sqlBody, /inventory_event_supersedes_check/i);
  assert.doesNotMatch(sqlBody, /client_event_id/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /canonical_unit/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
});

test("original inventory_events event_type used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.inventory_events[\s\S]*?event_type text not null\s+check \(event_type in \('receipt', 'count', 'waste', 'stockout', 'usage', 'adjustment', 'transfer', 'correction'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /event_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins inventory_events event_type to COLLATE C", () => {
  assert.match(pgTap, /select plan\(16\)/);
  assert.match(pgTap, /inventory_events_event_type_check exists/);
  assert.match(pgTap, /event_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /event_type CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token receipt matches under COLLATE C/);
  assert.match(pgTap, /writer token count matches under COLLATE C/);
  assert.match(pgTap, /writer token waste matches under COLLATE C/);
  assert.match(pgTap, /writer token stockout matches under COLLATE C/);
  assert.match(pgTap, /writer token usage matches under COLLATE C/);
  assert.match(pgTap, /writer token adjustment matches under COLLATE C/);
  assert.match(pgTap, /writer token transfer matches under COLLATE C/);
  assert.match(pgTap, /writer token correction matches under COLLATE C/);
  assert.match(pgTap, /spaced event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII event_type token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted event_type tokens match under COLLATE C/);
});
