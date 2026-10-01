import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261001070000_mise_005ec_pilot_requested_action_locale_pin.sql",
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
    "../supabase/tests/database/pilot_requested_action_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005EC pins pilot requested_action CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005EC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint pilot_operational_control_changes_requested_action_check\s+check \(\s*requested_action in \(\s*'enable-square-sync',\s*'enable-square-webhooks',\s*'enable-order-drafting',\s*'enable-gmail-delivery',\s*'disable-square',\s*'disable-order-drafting',\s*'disable-gmail-delivery',\s*'disable-external',\s*'pause-integrations',\s*'resume-normal'\s*\)\s*and requested_action collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`requested_action collate "C" ~ '${TOKEN_PATTERN}'`),
    "requested_action CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'enable-square-sync'") &&
      migration.includes("'enable-square-webhooks'") &&
      migration.includes("'enable-order-drafting'") &&
      migration.includes("'enable-gmail-delivery'") &&
      migration.includes("'disable-square'") &&
      migration.includes("'disable-order-drafting'") &&
      migration.includes("'disable-gmail-delivery'") &&
      migration.includes("'disable-external'") &&
      migration.includes("'pause-integrations'") &&
      migration.includes("'resume-normal'"),
    "exact requested_action allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_apply_pilot_operational_control/i);
  assert.doesNotMatch(sqlBody, /control_domain/i);
  assert.doesNotMatch(sqlBody, /reason_code/i);
  assert.doesNotMatch(sqlBody, /system_operational_controls/i);
  assert.doesNotMatch(sqlBody, /restaurant_operational_controls/i);
  assert.doesNotMatch(sqlBody, /alter table private\.operational_mode_changes/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_recommendations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
});

test("original pilot requested_action used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /requested_action text not null check \(requested_action in \(\s*'enable-square-sync',\s*'enable-square-webhooks',\s*'enable-order-drafting',\s*'enable-gmail-delivery',\s*'disable-square',\s*'disable-order-drafting',\s*'disable-gmail-delivery',\s*'disable-external',\s*'pause-integrations',\s*'resume-normal'\s*\)\)/
  );
  assert.doesNotMatch(
    original,
    /requested_action collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins pilot requested_action to COLLATE C", () => {
  assert.match(pgTap, /select plan\(18\)/);
  assert.match(
    pgTap,
    /pilot_operational_control_changes_requested_action_check exists/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes requested_action CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /pilot_operational_control_changes requested_action CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token enable-square-sync matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token enable-square-webhooks matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer token enable-order-drafting matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer token enable-gmail-delivery matches under COLLATE C/
  );
  assert.match(pgTap, /writer token disable-square matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token disable-order-drafting matches under COLLATE C/
  );
  assert.match(
    pgTap,
    /writer token disable-gmail-delivery matches under COLLATE C/
  );
  assert.match(pgTap, /writer token disable-external matches under COLLATE C/);
  assert.match(
    pgTap,
    /writer token pause-integrations matches under COLLATE C/
  );
  assert.match(pgTap, /writer token resume-normal matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced requested_action token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /empty requested_action token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated requested_action token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII requested_action token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted requested_action tokens match under COLLATE C/
  );
});
