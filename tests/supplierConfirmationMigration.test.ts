import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260901220631_record_supplier_confirmation_authenticated.sql",
  "utf8"
);
const pgTap = readFileSync(
  "supabase/tests/database/supplier_confirmation_manual.test.sql",
  "utf8"
);

test("authenticated confirmation RPC derives actor from auth.uid and stays manager-only", () => {
  assert.match(migration, /create or replace function public\.record_supplier_confirmation/i);
  assert.match(migration, /actor_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /private\.has_restaurant_role\(/);
  assert.match(migration, /array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /private\.service_record_supplier_confirmation\(/);
  assert.match(migration, /'manager_manual'/);
  assert.match(migration, /manager_confirmation:%s/);
  assert.match(migration, /grant execute on function public\.record_supplier_confirmation[\s\S]*to authenticated/i);
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.record_supplier_confirmation[\s\S]*to service_role/i
  );
});

test("database coverage exercises staff denial, tenant isolation, and idempotent replay", () => {
  for (const phrase of [
    "staff cannot record a supplier confirmation",
    "a manager cannot record another tenant confirmation",
    "a manager can record a supplier confirmation",
    "manager confirmation replay returns already_applied",
    "authenticated clients still cannot execute service_record_supplier_confirmation"
  ]) {
    assert.match(pgTap, new RegExp(phrase, "i"));
  }
});
