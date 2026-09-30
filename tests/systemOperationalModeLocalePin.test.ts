import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930190000_mise_005de_system_operational_mode_locale_pin.sql",
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
    "../supabase/tests/database/system_operational_mode_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DE pins system_operational_controls operational_mode CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DE"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint system_operational_controls_operational_mode_check\s+check \(\s*operational_mode in \('normal', 'read_only', 'integrations_paused', 'emergency'\)\s*and operational_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`operational_mode collate "C" ~ '${TOKEN_PATTERN}'`),
    "operational_mode CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'normal'") &&
      migration.includes("'read_only'") &&
      migration.includes("'integrations_paused'") &&
      migration.includes("'emergency'"),
    "exact operational_mode allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_set_system_operational_mode/i);
  assert.doesNotMatch(sqlBody, /ordering_policy/i);
  assert.doesNotMatch(sqlBody, /restaurant_operational_controls/i);
  assert.doesNotMatch(sqlBody, /operational_mode_changes/i);
  assert.doesNotMatch(sqlBody, /service_apply_pilot_operational_control/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
});

test("original system_operational_controls operational_mode used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.system_operational_controls[\s\S]*?operational_mode text not null default 'normal'\s*check \(operational_mode in \('normal', 'read_only', 'integrations_paused', 'emergency'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /operational_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins system_operational_controls operational_mode to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /system_operational_controls_operational_mode_check exists/);
  assert.match(
    pgTap,
    /system_operational_controls operational_mode CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /system_operational_controls operational_mode CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token normal matches under COLLATE C/);
  assert.match(pgTap, /writer token read_only matches under COLLATE C/);
  assert.match(pgTap, /writer token integrations_paused matches under COLLATE C/);
  assert.match(pgTap, /writer token emergency matches under COLLATE C/);
  assert.match(pgTap, /spaced operational_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /empty operational_mode token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated operational_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII operational_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted operational_mode tokens match under COLLATE C/
  );
});
