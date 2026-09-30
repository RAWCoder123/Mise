import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930150000_mise_005da_supplier_confirmation_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/20260802204120_operational_backend_foundation.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_confirmation_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DA pins supplier_order_confirmations confirmation_status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DA"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_order_confirmations_confirmation_status_check\s+check \(\s*confirmation_status in \('acknowledged', 'changed', 'rejected', 'unverified'\)\s*and confirmation_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`confirmation_status collate "C" ~ '${TOKEN_PATTERN}'`),
    "confirmation_status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'acknowledged'") &&
      migration.includes("'changed'") &&
      migration.includes("'rejected'") &&
      migration.includes("'unverified'"),
    "exact confirmation_status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_record_supplier_confirmation/i);
  assert.doesNotMatch(sqlBody, /confirmation_reference/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_status_check/i);
  assert.doesNotMatch(sqlBody, /supplier_deliveries/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /normalized_details/i);
});

test("original supplier_order_confirmations confirmation_status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.supplier_order_confirmations[\s\S]*?confirmation_status text not null check \(confirmation_status in \(\s*'acknowledged', 'changed', 'rejected', 'unverified'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /confirmation_status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins supplier_order_confirmations confirmation_status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /supplier_order_confirmations_confirmation_status_check exists/);
  assert.match(pgTap, /confirmation_status CHECK keeps exact allowlist/);
  assert.match(pgTap, /confirmation_status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token acknowledged matches under COLLATE C/);
  assert.match(pgTap, /writer token changed matches under COLLATE C/);
  assert.match(pgTap, /writer token rejected matches under COLLATE C/);
  assert.match(pgTap, /writer token unverified matches under COLLATE C/);
  assert.match(pgTap, /spaced confirmation_status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty confirmation_status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated confirmation_status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII confirmation_status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted confirmation_status tokens match under COLLATE C/);
});
