import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("supplier_order_lines migration is select-only for authenticated clients", () => {
  const migration = readFileSync(
    "supabase/migrations/20260827020000_supplier_order_lines.sql",
    "utf8"
  );
  const securityBackend = readFileSync("scripts/security-backend.mjs", "utf8");
  const securityStatic = readFileSync("scripts/security-static.mjs", "utf8");
  const tenantTests = readFileSync("supabase/tests/database/tenant_isolation.test.sql", "utf8");
  const exportEdge = readFileSync("supabase/functions/export-restaurant-data/index.ts", "utf8");

  assert.match(migration, /create table if not exists public\.supplier_order_lines/i);
  assert.match(migration, /grant select on public\.supplier_order_lines to authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant insert on table public\.supplier_order_lines to authenticated/i
  );
  assert.match(migration, /private\.sync_supplier_order_lines/i);
  assert.match(migration, /approve_purchase_recommendation_pre_order_lines/i);
  assert.match(migration, /undo_purchase_recommendation_action_pre_order_lines/i);
  assert.match(migration, /service_complete_supplier_email_send_pre_order_lines/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(securityBackend, /"supplier_order_lines"/);
  assert.match(securityStatic, /"supplier_order_lines"/);
  assert.match(tenantTests, /supplier_order_lines/);
  assert.match(exportEdge, /supplier_order_lines/);
});
