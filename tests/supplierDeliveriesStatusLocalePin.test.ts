import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930160000_mise_005db_supplier_deliveries_status_locale_pin.sql",
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
    "../supabase/tests/database/supplier_deliveries_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DB pins supplier_deliveries status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DB"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_deliveries_status_check\s+check \(\s*status in \('unverified', 'partially_received', 'received', 'discrepancy', 'failed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'unverified'") &&
      migration.includes("'partially_received'") &&
      migration.includes("'received'") &&
      migration.includes("'discrepancy'") &&
      migration.includes("'failed'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /service_receive_supplier_order/i);
  assert.doesNotMatch(sqlBody, /client_delivery_id/i);
  assert.doesNotMatch(sqlBody, /idempotency_key/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_status_check/i);
  assert.doesNotMatch(sqlBody, /supplier_order_confirmations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /alter table public\.mise_actions/i);
  assert.doesNotMatch(sqlBody, /\bnotes\b/);
});

test("original supplier_deliveries status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.supplier_deliveries[\s\S]*?status text not null default 'unverified' check \(status in \(\s*'unverified', 'partially_received', 'received', 'discrepancy', 'failed'\s*\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins supplier_deliveries status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(13\)/);
  assert.match(pgTap, /supplier_deliveries_status_check exists/);
  assert.match(pgTap, /supplier_deliveries status CHECK keeps exact allowlist/);
  assert.match(pgTap, /supplier_deliveries status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token unverified matches under COLLATE C/);
  assert.match(pgTap, /writer token partially_received matches under COLLATE C/);
  assert.match(pgTap, /writer token received matches under COLLATE C/);
  assert.match(pgTap, /writer token discrepancy matches under COLLATE C/);
  assert.match(pgTap, /writer token failed matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
