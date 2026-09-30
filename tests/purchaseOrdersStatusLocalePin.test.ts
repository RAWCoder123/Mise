import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930210000_mise_005dg_purchase_orders_status_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalBound = readFileSync(
  new URL(
    "../supabase/migrations/202606210002_restaurant_ops_backbone.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_orders_status_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DG pins purchase_orders status CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DG"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_orders_status_check\s+check \(\s*status in \('draft', 'submitted', 'received', 'cancelled'\)\s*and status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`status collate "C" ~ '${TOKEN_PATTERN}'`),
    "status CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'draft'") &&
      migration.includes("'submitted'") &&
      migration.includes("'received'") &&
      migration.includes("'cancelled'"),
    "exact status allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /purchase_orders_operational_values_check/i);
  assert.doesNotMatch(sqlBody, /purchase_orders_supplier_tenant_fkey/i);
  assert.doesNotMatch(sqlBody, /purchase_orders_supplier_id_required_check/i);
  assert.doesNotMatch(sqlBody, /alter table public\.supplier_orders/i);
  assert.doesNotMatch(sqlBody, /alter table public\.system_operational_controls/i);
  assert.doesNotMatch(sqlBody, /alter table public\.restaurant_operational_controls/i);
  assert.doesNotMatch(sqlBody, /ordering_policy/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.sales_imports/i);
  assert.doesNotMatch(sqlBody, /order_payload/i);
});

test("original purchase_orders status used bare IN without COLLATE C shape", () => {
  assert.match(
    originalBound,
    /create table if not exists public\.purchase_orders[\s\S]*?status text not null default 'draft' check \(status in \('draft', 'submitted', 'received', 'cancelled'\)\)/
  );
  assert.doesNotMatch(
    originalBound,
    /status collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_orders status to COLLATE C", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /purchase_orders_status_check exists/);
  assert.match(pgTap, /purchase_orders status CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_orders status CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token draft matches under COLLATE C/);
  assert.match(pgTap, /writer token submitted matches under COLLATE C/);
  assert.match(pgTap, /writer token received matches under COLLATE C/);
  assert.match(pgTap, /writer token cancelled matches under COLLATE C/);
  assert.match(pgTap, /spaced status token is rejected under COLLATE C/);
  assert.match(pgTap, /empty status token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated status token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII status token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted status tokens match under COLLATE C/);
});
