import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001060000_mise_005eb_operational_mode_changes_prior_next_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260727223000_enforce_emergency_operational_mode.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/operational_mode_changes_prior_next_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EB pins operational_mode_changes prior_mode and next_mode CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_mode_changes_prior_mode_check\s+check \(\s*prior_mode in \('normal', 'read_only', 'integrations_paused', 'emergency'\)\s*and prior_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint operational_mode_changes_next_mode_check\s+check \(\s*next_mode in \('normal', 'read_only', 'integrations_paused', 'emergency'\)\s*and next_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`prior_mode collate "C" ~ '${TOKEN_PATTERN}'`),
    "prior_mode CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`next_mode collate "C" ~ '${TOKEN_PATTERN}'`),
    "next_mode CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'normal'") &&
      migration.includes("'read_only'") &&
      migration.includes("'integrations_paused'") &&
      migration.includes("'emergency'"),
    "exact prior_mode/next_mode allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_set_system_operational_mode/i);
  assert.doesNotMatch(sqlBody, /system_operational_controls/i);
  assert.doesNotMatch(sqlBody, /reason_code/i);
  assert.doesNotMatch(sqlBody, /requested_action/i);
  assert.doesNotMatch(sqlBody, /restaurant_operational_controls/i);
  assert.doesNotMatch(sqlBody, /service_apply_pilot_operational_control/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_lines/i);
});

test("original operational_mode_changes prior_mode/next_mode used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists private\.operational_mode_changes[\s\S]*?prior_mode text not null\s*check \(prior_mode in \('normal', 'read_only', 'integrations_paused', 'emergency'\)\),\s*next_mode text not null\s*check \(next_mode in \('normal', 'read_only', 'integrations_paused', 'emergency'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /prior_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    originalBound,
    /next_mode collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins operational_mode_changes prior_mode/next_mode to COLLATE C", () => {
  assert.match(pgTap, /select plan\(20\)/);
  assert.match(pgTap, /operational_mode_changes_prior_mode_check exists/);
  assert.match(
    pgTap,
    /operational_mode_changes prior_mode CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /operational_mode_changes prior_mode CHECK uses COLLATE C/
  );
  assert.match(pgTap, /operational_mode_changes_next_mode_check exists/);
  assert.match(
    pgTap,
    /operational_mode_changes next_mode CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /operational_mode_changes next_mode CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token normal matches under COLLATE C/);
  assert.match(pgTap, /writer token read_only matches under COLLATE C/);
  assert.match(pgTap, /writer token integrations_paused matches under COLLATE C/);
  assert.match(pgTap, /writer token emergency matches under COLLATE C/);
  assert.match(pgTap, /spaced prior_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced next_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /empty prior_mode token is rejected under COLLATE C/);
  assert.match(pgTap, /empty next_mode token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated prior_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated next_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII prior_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII next_mode token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted prior_mode tokens match under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted next_mode tokens match under COLLATE C/
  );
});
