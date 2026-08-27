import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260827070000_receive_discrepancy_short_ship_learning.sql"),
  "utf8"
);
const operationalSignals = readFileSync(join(root, "services/domain/operationalSignals.ts"), "utf8");
const receiveLearning = readFileSync(join(root, "services/domain/receiveDiscrepancyLearning.ts"), "utf8");

test("short-ship migration exposes receivingHistory via a bounded helper", () => {
  assert.match(migration, /create or replace function private\.receiving_history_json/i);
  assert.match(migration, /'receivingHistory',\s*private\.receiving_history_json\(p_restaurant_id\)/);
  assert.match(migration, /from public\.supplier_delivery_items item/i);
  assert.match(migration, /join public\.supplier_deliveries delivery/i);
  assert.match(migration, /limit 500/i);
  assert.match(migration, /grant execute on function private\.receiving_history_json\(uuid\) to service_role/i);
  assert.doesNotMatch(migration, /grant execute on function private\.receiving_history_json\(uuid\) to (authenticated|anon)/i);
});

test("operational signals apply receive fill bias after approval learning", () => {
  assert.match(operationalSignals, /receivingHistory\?:/i);
  assert.match(operationalSignals, /buildReceiveFillBiasByItem/i);
  assert.match(operationalSignals, /applyReceiveFillBias/i);
  assert.match(operationalSignals, /insight\.rule\.ordering\.chronic_short_ship/);
  assert.match(receiveLearning, /RECEIVE_FILL_MULTIPLIER_MAX = 1\.25/);
  assert.match(receiveLearning, /extractReceiveSamplesFromDeliveries/);
});
