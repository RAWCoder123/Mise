import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260927110000_mise_005an_reason_code_check_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalMode = readFileSync(
  new URL(
    "../supabase/migrations/20260727223000_enforce_emergency_operational_mode.sql",
    import.meta.url
  ),
  "utf8"
);
const originalPilot = readFileSync(
  new URL(
    "../supabase/migrations/20260824230000_mise_pilot_001_atomic_controls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/reason_code_check_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const REASON_PATTERN = "^[a-z0-9_]{3,64}$";

test("MISE-005AN pins reason_code CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005AN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint operational_mode_changes_reason_code_check check \(\s*reason_code collate "C" ~ '\^\[a-z0-9_\]\{3,64\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint pilot_operational_control_changes_reason_code_check check \(\s*reason_code collate "C" ~ '\^\[a-z0-9_\]\{3,64\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`reason_code collate "C" ~ '${REASON_PATTERN}'`),
    "both CHECKs must pin reason_code under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite writers owned by open stacks.
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.service_set_system_operational_mode/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.service_apply_pilot_operational_control/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.service_record_mise_action_failure/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.record_operational_finding_decision/i
  );
  assert.doesNotMatch(
    sqlBody,
    /operational_finding_decisions_policy_version_check/i
  );
  assert.doesNotMatch(
    sqlBody,
    /operational_finding_decisions_finding_id_shape_check/i
  );
});

test("original reason_code CHECKs were bare", () => {
  assert.match(
    originalMode,
    /reason_code text not null\s*check \(reason_code ~ '\^\[a-z0-9_\]\{3,64\}\$'\)/
  );
  assert.doesNotMatch(
    originalMode,
    /reason_code collate "C" ~ '\^\[a-z0-9_\]\{3,64\}\$'/
  );

  assert.match(
    originalPilot,
    /reason_code text not null check \(reason_code ~ '\^\[a-z0-9_\]\{3,64\}\$'\)/
  );
  assert.doesNotMatch(
    originalPilot,
    /reason_code collate "C" ~ '\^\[a-z0-9_\]\{3,64\}\$'/
  );
});

test("pgTAP fixture pins reason_code CHECKs to COLLATE C", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /operational_mode_changes_reason_code_check exists/);
  assert.match(
    pgTap,
    /operational_mode_changes reason_code CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes_reason_code_check exists/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes reason_code CHECK uses COLLATE C/
  );
  assert.match(pgTap, /ASCII snake_case reason_code matches under COLLATE C/);
  assert.match(pgTap, /uppercase reason_code is rejected under COLLATE C/);
  assert.match(pgTap, /too-short reason_code is rejected under COLLATE C/);
  assert.match(pgTap, /hyphenated reason_code is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /operational_mode_changes has no bare reason_code class CHECK/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes has no bare reason_code class CHECK/
  );
});
