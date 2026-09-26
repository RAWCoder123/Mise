import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInitialDemoState } from "../services/demo/replaceableDemoData";
import { createPurchaseDecisionBaseEvent } from "../services/domain/purchaseDecisionMemory";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926021500_mise_005h_purchase_decision_unit_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const decisionMemory = readFileSync(
  new URL(
    "../supabase/migrations/20260824120000_mise_004a_purchase_decision_memory.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/purchaseDecisionMemory.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_decision_unit_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const actorA = "00000000-0000-4000-8000-000000000011";

test("MISE-005H pins purchase_decision_events.recommendation_unit cntrl CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005H"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists purchase_decision_events_recommendation_unit_check/i
  );
  assert.match(
    migration,
    /add constraint purchase_decision_events_recommendation_unit_check[\s\S]*?recommendation_unit collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /length\(trim\(recommendation_unit\)\) between 1 and 80/
  );
  // Compose with open stacks: do not rewrite decision wrappers.
  assert.doesNotMatch(
    migration,
    /create or replace function public\.approve_purchase_recommendation/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.dismiss_purchase_recommendation/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.undo_purchase_recommendation/i
  );
});

test("MISE-004A originally left recommendation_unit cntrl CHECK unpinned", () => {
  assert.match(
    decisionMemory,
    /recommendation_unit text not null check \(\s*length\(trim\(recommendation_unit\)\) between 1 and 80\s*and recommendation_unit !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    decisionMemory,
    /recommendation_unit collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("domain documents MISE-005H ASCII C [[:cntrl:]] parity for recommendation units", () => {
  assert.match(domain, /MISE-005H/);
  assert.match(domain, /CONTROL_CHARACTERS = \/\[\\u0000-\\u001f\\u007f\]\/u/);
});

test("createPurchaseDecisionBaseEvent rejects ASCII control characters in recommendation units", () => {
  const state = createInitialDemoState("Square");
  const item = {
    ...state.inventoryItems[0]!,
    canonical_unit: "each" as const,
    canonical_quantity_per_unit: 1,
    canonical_unit_verification_status: "verified" as const,
    canonical_unit_verified_at: "2026-08-01T00:00:00.000Z",
    canonical_unit_verified_by: actorA
  };
  const recommendation = {
    ...state.purchaseRecommendations[0]!,
    id: "00000000-0000-4000-8000-000000000101",
    restaurant_id: item.restaurant_id,
    inventory_item_id: item.id,
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    recommended_quantity: 10,
    unit: "ca\u0001se",
    status: "pending" as const,
    generation_source: "mise_rules" as const,
    planning_revision: 42
  };

  assert.throws(
    () =>
      createPurchaseDecisionBaseEvent({
        id: "event-control",
        sequence: 1,
        recommendation,
        inventoryItem: item,
        decision: "approve",
        suggestedQuantity: 10,
        chosenQuantity: 10,
        actorUserId: actorA,
        actorRole: "manager",
        sourceAuditLogId: "audit-control",
        contextEvidence: { planningRevision: 42 },
        occurredAt: "2026-09-26T00:00:00.000Z"
      }),
    /recommendationUnit must be bounded printable text/
  );
});

test("pgTAP fixture pins the recommendation_unit CHECK site", () => {
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(pgTap, /purchase_decision_events_recommendation_unit_check/);
  assert.match(pgTap, /recommendation_unit collate "C" !~/);
  assert.match(pgTap, /\[\[:cntrl:\]\]/);
});
