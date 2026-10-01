import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260826230000_purchase_loop_receive_outcome.sql", import.meta.url),
  "utf8"
);

test("purchase-loop receive outcome migration enriches delivery action outcomes", () => {
  assert.match(migration, /private\.purchase_loop_receive_outcome_payload/);
  assert.match(migration, /mise\.purchase_loop_outcome\.v1/);
  assert.match(migration, /countVariancePending/);
  assert.match(migration, /predictedQuantity/);
  assert.match(migration, /orderedQuantity/);
  assert.match(migration, /usableReceivedQuantity/);
  assert.match(migration, /purchase_loop\.receive\.matched/);
  assert.match(
    migration,
    /create or replace function public\.record_supplier_delivery_mise_003b_name_base/
  );
  assert.match(migration, /outcome_payload\.expected_result/);
  assert.match(migration, /outcome_payload\.actual_result/);
  assert.match(migration, /outcome_payload\.variance/);
  assert.match(migration, /countVariancePending',\s*true/);
  assert.doesNotMatch(
    migration,
    /insert into public\.action_outcomes[\s\S]*jsonb_build_object\(\s*'deliveryStatus',\s*'received'\s*\)/
  );
});
