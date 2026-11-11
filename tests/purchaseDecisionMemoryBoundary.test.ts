import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration004a = readFileSync(
  new URL("../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql", import.meta.url),
  "utf8"
);
const migration004b = readFileSync(
  new URL("../supabase/migrations/20260827060000_mise_004b_pattern_advisory_quantity.sql", import.meta.url),
  "utf8"
);
const recommendationDomain = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const operationalSignals = readFileSync(
  new URL("../services/domain/operationalSignals.ts", import.meta.url),
  "utf8"
);
const purchaseAuthority = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);
const ordersApplication = readFileSync(
  new URL("../services/application/orders.ts", import.meta.url),
  "utf8"
);
const supplierSend = readFileSync(
  new URL("../services/domain/supplierSendContent.ts", import.meta.url),
  "utf8"
);
const ordersScreen = readFileSync(new URL("../app/(tabs)/orders.tsx", import.meta.url), "utf8");
const purchaseDecisionMemory = readFileSync(
  new URL("../services/domain/purchaseDecisionMemory.ts", import.meta.url),
  "utf8"
);

test("purchase memory wraps but does not replace locked purchase workflows", () => {
  assert.match(migration004a, /approve_purchase_recommendation_mise_003c_base/);
  assert.match(migration004a, /undo_purchase_recommendation_action_mise_003c_base/);
  assert.match(migration004a, /dismiss_purchase_recommendation_pre_mise_004a/);
  assert.doesNotMatch(purchaseAuthority, /purchaseDecision|purchase_decision/i);
});

test("004B may advise recommendation quantity without touching supplier-send or Orders inputs", () => {
  assert.match(recommendationDomain, /applyEstablishedPatternAdvisoryQuantity/);
  assert.match(operationalSignals, /applyEstablishedPatternAdvisoryQuantity/);
  assert.match(purchaseDecisionMemory, /applyEstablishedPatternAdvisoryQuantity/);
  assert.doesNotMatch(supplierSend, /purchaseDecisionMemory|purchase_decision_events/);
  assert.doesNotMatch(migration004b, /update\s+public\.purchase_recommendations[\s\S]{0,200}quantity_ratio/i);
  assert.doesNotMatch(migration004b, /approve_purchase_recommendation|dismiss_purchase_recommendation|send-supplier-email/);
});

test("raw evidence is private, append-only, bounded, and written only by trusted wrappers", () => {
  assert.match(migration004a, /revoke all on table public\.purchase_decision_events from public, anon, authenticated/);
  assert.match(migration004a, /Purchase decision events are append-only/);
  assert.match(migration004a, /pg_column_size\(context_evidence\) <= 8192/);
  assert.doesNotMatch(migration004a, /grant insert on table public\.purchase_decision_events to authenticated/);
  assert.doesNotMatch(migration004a, /operator_note|order_message|gmail|access_token|refresh_token|raw_pos/i);
});

test("pattern policy is deterministic and centralized per runtime", () => {
  assert.match(migration004a, /grouped\.sample_count >= 5/);
  assert.match(migration004a, />= 0\.8 then 'established'/);
  assert.match(migration004a, /mise\.purchase_pattern\.v1/);
  assert.match(migration004a, /decision_type in \('undo', 'exclude_from_learning'\)/);
  assert.match(migration004b, /private\.purchase_decision_patterns_json/);
  assert.match(migration004b, /purchaseDecisionPatterns/);
});

test("Orders displays memory as factual context without changing the quantity input", () => {
  assert.match(ordersScreen, /fetchAdvisoryPurchaseDecisionPatterns/);
  assert.match(ordersApplication, /resolveAdvisoryPurchaseDecisionPatterns/);
  assert.match(ordersScreen, /pattern\.eligible && pattern\.currentContext/);
  assert.doesNotMatch(ordersScreen, /setQuantities\([^)]*purchaseDecisionPattern/);
  assert.doesNotMatch(ordersScreen, /recommended_quantity\s*=\s*purchaseDecisionPattern/);
});

test("004B never suppresses recommendations from dismiss-dominant patterns", () => {
  assert.match(purchaseDecisionMemory, /dominantOutcome === "exact"/);
  assert.match(purchaseDecisionMemory, /dominantOutcome === "upward"/);
  assert.match(purchaseDecisionMemory, /dominantOutcome === "downward"/);
  assert.doesNotMatch(
    purchaseDecisionMemory,
    /selectAdvisoryPurchaseDecisionPattern[\s\S]{0,800}dominantOutcome === "dismiss"/
  );
});
