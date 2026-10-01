import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001080000_mise_005ed_pilot_backend_identity_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260824230000_mise_pilot_001_atomic_controls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/pilot_backend_identity_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005ED pins pilot backend_identity CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005ED"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pilot_operational_control_changes_backend_identity_check\s+check \(\s*backend_identity = 'service_role_rpc'\s*and backend_identity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`backend_identity collate "C" ~ '${TOKEN_PATTERN}'`),
    "backend_identity CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("backend_identity = 'service_role_rpc'"),
    "exact backend_identity equality must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_apply_pilot_operational_control/i);
  assert.doesNotMatch(sqlBody, /requested_action/i);
  assert.doesNotMatch(sqlBody, /control_domain/i);
  assert.doesNotMatch(sqlBody, /reason_code/i);
  assert.doesNotMatch(sqlBody, /system_operational_controls/i);
  assert.doesNotMatch(sqlBody, /restaurant_operational_controls/i);
  assert.doesNotMatch(sqlBody, /alter table private\.operational_mode_changes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
});

test("original pilot backend_identity used bare equality without COLLATE C shape", () => {
  assert.match(
    original,
    /backend_identity text not null default 'service_role_rpc'\s*check \(backend_identity = 'service_role_rpc'\)/
  );
  assert.doesNotMatch(
    original,
    /backend_identity collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins pilot backend_identity to COLLATE C", () => {
  assert.match(pgTap, /select plan\(9\)/);
  assert.match(
    pgTap,
    /pilot_operational_control_changes_backend_identity_check exists/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes backend_identity CHECK keeps exact equality/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes backend_identity CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /writer token service_role_rpc matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /spaced backend_identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty backend_identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated backend_identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII backend_identity token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted backend_identity tokens match under COLLATE C/
  );
});
