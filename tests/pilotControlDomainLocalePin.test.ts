import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001020000_mise_005dx_pilot_control_domain_locale_pin.sql",
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
    "../supabase/tests/database/pilot_control_domain_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DX pins pilot control_domain CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DX"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pilot_operational_control_changes_control_domain_check\s+check \(\s*control_domain in \(\s*'square',\s*'drafting',\s*'gmail',\s*'external',\s*'system_mode'\s*\)\s*and control_domain collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`control_domain collate "C" ~ '${TOKEN_PATTERN}'`),
    "control_domain CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'square'") &&
      migration.includes("'drafting'") &&
      migration.includes("'gmail'") &&
      migration.includes("'external'") &&
      migration.includes("'system_mode'"),
    "exact control_domain allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_apply_pilot_operational_control/i);
  assert.doesNotMatch(sqlBody, /requested_action/i);
  assert.doesNotMatch(sqlBody, /reason_code/i);
  assert.doesNotMatch(sqlBody, /system_operational_controls/i);
  assert.doesNotMatch(sqlBody, /restaurant_operational_controls/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table private\.operational_mode_changes/i);
});

test("original pilot control_domain used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /control_domain text not null\s+check \(control_domain in \('square', 'drafting', 'gmail', 'external', 'system_mode'\)\)/
  );
  assert.doesNotMatch(
    original,
    /control_domain collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins pilot control_domain to COLLATE C", () => {
  assert.match(pgTap, /select plan\(13\)/);
  assert.match(
    pgTap,
    /pilot_operational_control_changes_control_domain_check exists/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes control_domain CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes control_domain CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token square matches under COLLATE C/);
  assert.match(pgTap, /writer token drafting matches under COLLATE C/);
  assert.match(pgTap, /writer token gmail matches under COLLATE C/);
  assert.match(pgTap, /writer token external matches under COLLATE C/);
  assert.match(pgTap, /writer token system_mode matches under COLLATE C/);
  assert.match(pgTap, /spaced control_domain token is rejected under COLLATE C/);
  assert.match(pgTap, /empty control_domain token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated control_domain token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII control_domain token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted control_domain tokens match under COLLATE C/
  );
});
