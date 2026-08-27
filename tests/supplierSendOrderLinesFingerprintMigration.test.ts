import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("supplier send order-lines fingerprint migration is additive and SELECT-safe", () => {
  const migration = readFileSync(
    "supabase/migrations/20260827030000_supplier_send_order_lines_fingerprint.sql",
    "utf8"
  );
  assert.match(migration, /create or replace function private\.build_supplier_send_content/);
  assert.match(migration, /from public\.supplier_order_lines line/);
  assert.match(migration, /ordered_quantity/);
  assert.match(
    migration,
    /revoke all on function private\.build_supplier_send_content\(uuid, uuid\)/
  );
  assert.doesNotMatch(migration, /grant execute on function private\.build_supplier_send_content/);
  assert.doesNotMatch(
    migration,
    /from public\.purchase_recommendations recommendation[\s\S]{0,400}recommended_quantity/
  );
});
