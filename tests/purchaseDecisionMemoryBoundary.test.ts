import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql", import.meta.url),
  "utf8"
);
const recommendationDomain = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const purchaseAuthority = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);
const supplierSend = readFileSync(
  new URL("../services/domain/supplierSendContent.ts", import.meta.url),
  "utf8"
);
const ordersScreen = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");

test("purchase memory wraps but does not replace locked purchase workflows", () => {
  assert.match(migration, /approve_purchase_recommendation_mise_003c_base/);
  assert.match(migration, /undo_purchase_recommendation_action_mise_003c_base/);
  assert.match(migration, /dismiss_purchase_recommendation_pre_mise_004a/);
  assert.doesNotMatch(purchaseAuthority, /purchaseDecision|purchase_decision/i);
});

test("purchase memory cannot feed recommendation or supplier-send authority in 004A", () => {
  assert.doesNotMatch(recommendationDomain, /purchaseDecisionMemory|purchase_decision_events/);
  assert.doesNotMatch(supplierSend, /purchaseDecisionMemory|purchase_decision_events/);
  assert.doesNotMatch(migration, /update\s+public\.purchase_recommendations[\s\S]{0,200}quantity_ratio/i);
});

test("raw evidence is private, append-only, bounded, and written only by trusted wrappers", () => {
  assert.match(migration, /revoke all on table public\.purchase_decision_events from public, anon, authenticated/);
  assert.match(migration, /Purchase decision events are append-only/);
  assert.match(migration, /pg_column_size\(context_evidence\) <= 8192/);
  assert.doesNotMatch(migration, /grant insert on table public\.purchase_decision_events to authenticated/);
  assert.doesNotMatch(migration, /operator_note|order_message|gmail|access_token|refresh_token|raw_pos/i);
});

test("pattern policy is deterministic and centralized per runtime", () => {
  assert.match(migration, /grouped\.sample_count >= 5/);
  assert.match(migration, />= 0\.8 then 'established'/);
  assert.match(migration, /mise\.purchase_pattern\.v1/);
  assert.match(migration, /decision_type in \('undo', 'exclude_from_learning'\)/);
});

test("Orders displays memory as factual context without changing the quantity input", () => {
  assert.match(ordersScreen, /fetchPurchaseDecisionPatterns/);
  assert.match(ordersScreen, /pattern\.eligible && pattern\.currentContext/);
  assert.doesNotMatch(ordersScreen, /setQuantities\([^)]*purchaseDecisionPattern/);
  assert.doesNotMatch(ordersScreen, /recommended_quantity\s*=\s*purchaseDecisionPattern/);
});
