import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260827001000_purchase_loop_count_variance.sql", import.meta.url),
  "utf8"
);

test("purchase-loop count variance migration records outcomes on count approval", () => {
  assert.match(migration, /private\.purchase_loop_count_outcome_payload/);
  assert.match(migration, /private\.record_purchase_loop_count_outcome/);
  assert.match(migration, /mise\.purchase_loop_outcome\.v1/);
  assert.match(migration, /purchase_loop\.count\.matched/);
  assert.match(migration, /purchase_loop\.count\.short/);
  assert.match(migration, /purchase_loop\.count\.over/);
  assert.match(migration, /purchase_loop\.count\.mixed/);
  assert.match(migration, /countVariancePending',\s*false/);
  assert.match(migration, /linkedReceiveOutcomeIds/);
  assert.match(migration, /measure_outcome/);
  assert.match(
    migration,
    /create or replace function private\.service_approve_inventory_count_session/
  );
  assert.match(migration, /private\.record_purchase_loop_count_outcome\(/);
  assert.match(migration, /purchase_loop_count_outcome_id/);
  assert.doesNotMatch(migration, /countVariancePending',\s*true/);
});
