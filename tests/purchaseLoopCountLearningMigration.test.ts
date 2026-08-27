import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260827080000_purchase_loop_count_learning.sql"),
  "utf8"
);
const operationalSignals = readFileSync(join(root, "services/domain/operationalSignals.ts"), "utf8");
const purchaseLoopLearning = readFileSync(
  join(root, "services/domain/purchaseLoopLearning.ts"),
  "utf8"
);

test("count-learning migration exposes purchaseLoopCountHistory via a bounded helper", () => {
  assert.match(migration, /create or replace function private\.purchase_loop_count_history_json/i);
  assert.match(
    migration,
    /'purchaseLoopCountHistory',\s*private\.purchase_loop_count_history_json\(p_restaurant_id\)/
  );
  assert.match(migration, /from public\.action_outcomes outcome/i);
  assert.match(migration, /mise\.purchase_loop_outcome\.v1/);
  assert.match(migration, /phase' = 'count'/);
  assert.match(migration, /limit 500/i);
  assert.match(
    migration,
    /grant execute on function private\.purchase_loop_count_history_json\(uuid\) to service_role/i
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function private\.purchase_loop_count_history_json\(uuid\) to (authenticated|anon)/i
  );
});

test("operational signals apply purchase-loop count bias after approval learning", () => {
  assert.match(operationalSignals, /purchaseLoopCountHistory\?:/i);
  assert.match(operationalSignals, /buildPurchaseLoopCountBiasByItem/i);
  assert.match(operationalSignals, /applyPurchaseLoopCountBias/i);
  assert.match(operationalSignals, /insight\.rule\.ordering\.chronic_count_short/);
  assert.match(purchaseLoopLearning, /PURCHASE_LOOP_COUNT_MULTIPLIER_MAX = 1\.25/);
  assert.match(purchaseLoopLearning, /extractPurchaseLoopCountSamples/);
});
