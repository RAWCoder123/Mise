import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260929230000_mise_005ck_supplier_orders_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/202606210001_secure_multi_tenant_rls.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_orders_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005CK pins supplier_orders status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005CK"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_orders_status_check\s+check \(\s*status in \('draft', 'sent', 'completed'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'draft'") &&
      migration.includes("'sent'") &&
      migration.includes("'completed'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_operational_values_check/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_purchase_authority_check/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_send_content_revision_check/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_email_delivery_check/i);
  assert.doesNotMatch(sqlBody, /approve_supplier_send/i);
  assert.doesNotMatch(sqlBody, /service_complete_supplier_email_send/i);
  assert.doesNotMatch(sqlBody, /recalculation_runs/i);
  assert.doesNotMatch(sqlBody, /inventory_count_sessions/i);
  assert.doesNotMatch(sqlBody, /recipe_versions/i);
  assert.doesNotMatch(sqlBody, /restaurant_tasks/i);
  assert.doesNotMatch(sqlBody, /alter table public\.activity_events/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_memories/i);
  assert.doesNotMatch(sqlBody, /order_message/i);
});

test("original supplier_orders status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.supplier_orders[\s\S]*?status text not null default 'draft' check \(status in \('draft', 'sent', 'completed'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins supplier_orders status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /supplier_orders_status_check exists/);
  assert.match(pgTap, /supplier_orders status CHECK keeps exact allowlist/);
  assert.match(pgTap, /supplier_orders status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token draft matches under COLLATE C/);
  assert.match(pgTap, /writer token sent matches under COLLATE C/);
  assert.match(pgTap, /writer token completed matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
