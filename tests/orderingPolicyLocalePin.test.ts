import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930200000_mise_005df_ordering_policy_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260728203500_enforce_provider_kill_switches.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ordering_policy_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DF pins system and restaurant ordering_policy CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DF"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint system_operational_controls_ordering_policy_check\s+check \(\s*ordering_policy in \('off', 'draft_only'\)\s*and ordering_policy collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint restaurant_operational_controls_ordering_policy_check\s+check \(\s*ordering_policy in \('off', 'draft_only'\)\s*and ordering_policy collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`ordering_policy collate "C" ~ '${TOKEN_PATTERN}'`),
    "ordering_policy CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'off'") && migration.includes("'draft_only'"),
    "exact ordering_policy allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /order_drafting_policy_check/i);
  assert.doesNotMatch(sqlBody, /order_drafting_enabled/i);
  assert.doesNotMatch(sqlBody, /operational_mode/i);
  assert.doesNotMatch(sqlBody, /service_set_system_operational_mode/i);
  assert.doesNotMatch(sqlBody, /service_apply_pilot_operational_control/i);
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
});

test("original ordering_policy used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /add constraint system_operational_controls_ordering_policy_check\s+check \(ordering_policy in \('off', 'draft_only'\)\)/
  );
  assert.match(
    originalBound,
    /add constraint restaurant_operational_controls_ordering_policy_check\s+check \(ordering_policy in \('off', 'draft_only'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /ordering_policy collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins ordering_policy to COLLATE C", () => {
  assert.match(pgTap, /select plan\(13\)/);
  assert.match(pgTap, /system_operational_controls_ordering_policy_check exists/);
  assert.match(
    pgTap,
    /restaurant_operational_controls_ordering_policy_check exists/
  );
  assert.match(
    pgTap,
    /system_operational_controls ordering_policy CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /system_operational_controls ordering_policy CHECK uses COLLATE C/
  );
  assert.match(
    pgTap,
    /restaurant_operational_controls ordering_policy CHECK keeps exact allowlist/
  );
  assert.match(
    pgTap,
    /restaurant_operational_controls ordering_policy CHECK uses COLLATE C/
  );
  assert.match(pgTap, /writer token off matches under COLLATE C/);
  assert.match(pgTap, /writer token draft_only matches under COLLATE C/);
  assert.match(pgTap, /spaced ordering_policy token is rejected under COLLATE C/);
  assert.match(pgTap, /empty ordering_policy token is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /punctuated ordering_policy token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII ordering_policy token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /all allowlisted ordering_policy tokens match under COLLATE C/
  );
});
