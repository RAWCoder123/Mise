import assert from "node:assert/strict";
import test from "node:test";

import { createInitialDemoState } from "../services/demo/replaceableDemoData";
import {
  PURCHASE_DECISION_CONSISTENCY_THRESHOLD,
  PURCHASE_DECISION_EVIDENCE_VERSION,
  PURCHASE_DECISION_MINIMUM_SAMPLE_COUNT,
  PURCHASE_DECISION_PATTERN_VERSION,
  buildPurchaseDecisionPatterns,
  createPurchaseDecisionBaseEvent,
  createPurchaseDecisionCompensation,
  type PurchaseDecisionEvent
} from "../services/domain/purchaseDecisionMemory";

const actorA = "00000000-0000-4000-8000-000000000011";
const actorB = "00000000-0000-4000-8000-000000000012";

function fixture() {
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
    unit: item.unit,
    status: "pending" as const,
    generation_source: "mise_rules" as const,
    planning_revision: 42
  };
  return { item, recommendation };
}

function baseEvent(
  sequence: number,
  decision: "approve" | "dismiss" = "approve",
  chosenQuantity: number | null = 10,
  overrides: Partial<PurchaseDecisionEvent> = {}
) {
  const { item, recommendation } = fixture();
  return {
    ...createPurchaseDecisionBaseEvent({
      id: `event-${sequence}`,
      sequence,
      recommendation,
      inventoryItem: item,
      decision,
      suggestedQuantity: 10,
      chosenQuantity,
      actorUserId: sequence % 2 ? actorA : actorB,
      actorRole: sequence % 2 ? "manager" : "owner",
      sourceAuditLogId: `audit-${sequence}`,
      contextEvidence: { planningRevision: 42, countEventId: `count-${sequence}` },
      occurredAt: new Date(Date.UTC(2026, 7, sequence)).toISOString()
    }),
    ...overrides
  };
}

test("purchase decision event keeps exact suggested and overridden canonical snapshots", () => {
  const { item, recommendation } = fixture();
  item.canonical_quantity_per_unit = 1000;
  const event = createPurchaseDecisionBaseEvent({
    id: "event-converted",
    sequence: 1,
    recommendation,
    inventoryItem: item,
    decision: "approve",
    suggestedQuantity: 10,
    chosenQuantity: 8,
    actorUserId: actorA,
    actorRole: "manager",
    sourceAuditLogId: "audit-converted",
    contextEvidence: { planningRevision: 42, countEventId: "count-converted" },
    occurredAt: "2026-08-01T00:00:00.000Z"
  });
  assert.equal(event.decisionType, "approve_with_override");
  assert.equal(event.recommendedQuantity, 10);
  assert.equal(event.chosenQuantity, 8);
  assert.equal(event.quantityRatio, 0.8);
  assert.equal(event.quantityDelta, -2);
  assert.equal(event.canonicalQuantityDelta, -2000);
  assert.equal(event.evidenceVersion, PURCHASE_DECISION_EVIDENCE_VERSION);
  assert.deepEqual(event.contextEvidence, { planningRevision: 42, countEventId: "count-converted" });
});

test("dismissal records explicit evidence without inventing a chosen quantity", () => {
  const event = baseEvent(1, "dismiss", null);
  assert.equal(event.decisionType, "dismiss");
  assert.equal(event.chosenQuantity, null);
  assert.equal(event.chosenCanonicalQuantity, null);
  assert.equal(event.quantityDelta, null);
  assert.equal(event.canonicalQuantityDelta, null);
  assert.equal(event.quantityRatio, null);
});

test("five consistent downward overrides establish a factual eligible pattern", () => {
  const { item } = fixture();
  const patterns = buildPurchaseDecisionPatterns(
    Array.from({ length: PURCHASE_DECISION_MINIMUM_SAMPLE_COUNT }, (_, index) =>
      baseEvent(index + 1, "approve", 8)
    ),
    [item],
    new Date("2026-08-31T00:00:00.000Z")
  );
  assert.equal(PURCHASE_DECISION_CONSISTENCY_THRESHOLD, 0.8);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0]!.patternVersion, PURCHASE_DECISION_PATTERN_VERSION);
  assert.equal(patterns[0]!.eligible, true);
  assert.equal(patterns[0]!.evidenceStrength, "established");
  assert.equal(patterns[0]!.dominantOutcome, "downward");
  assert.equal(patterns[0]!.downwardOverrideCount, 5);
  assert.equal(patterns[0]!.medianQuantityRatio, 0.8);
});

test("five contradictory decisions are eligible but never established", () => {
  const { item } = fixture();
  const patterns = buildPurchaseDecisionPatterns(
    [
      baseEvent(1, "approve", 8),
      baseEvent(2, "approve", 8),
      baseEvent(3, "approve", 12),
      baseEvent(4, "approve", 10),
      baseEvent(5, "dismiss", null)
    ],
    [item]
  );
  assert.equal(patterns[0]!.eligible, true);
  assert.equal(patterns[0]!.evidenceStrength, "emerging");
  assert.equal(patterns[0]!.dominantOutcome, "mixed");
});

test("fewer than five active decisions remain insufficient", () => {
  const { item } = fixture();
  const pattern = buildPurchaseDecisionPatterns(
    [baseEvent(1), baseEvent(2), baseEvent(3), baseEvent(4)],
    [item]
  )[0]!;
  assert.equal(pattern.eligible, false);
  assert.equal(pattern.evidenceStrength, "insufficient");
});

test("undo and deterministic exclusion compensate evidence without mutating history", () => {
  const { item } = fixture();
  const kept = baseEvent(1);
  const undone = baseEvent(2);
  const excluded = baseEvent(3);
  const undo = createPurchaseDecisionCompensation({
    id: "undo-2",
    sequence: 4,
    target: undone,
    decisionType: "undo",
    actorUserId: actorB,
    actorRole: "owner",
    sourceAuditLogId: "audit-undo-2",
    sourceEventKey: "audit_log:audit-undo-2",
    occurredAt: "2026-08-20T00:00:00.000Z"
  });
  const exclusion = createPurchaseDecisionCompensation({
    id: "exclude-3",
    sequence: 5,
    target: excluded,
    decisionType: "exclude_from_learning",
    actorUserId: actorA,
    actorRole: "manager",
    sourceAuditLogId: "audit-exclude-3",
    sourceEventKey: "purchase_decision_exclusion:event-3",
    occurredAt: "2026-08-21T00:00:00.000Z"
  });
  const pattern = buildPurchaseDecisionPatterns(
    [kept, undone, excluded, undo, exclusion],
    [item]
  )[0]!;
  assert.equal(pattern.sampleCount, 1);
  assert.equal(pattern.evidenceEventIds[0], kept.id);
  assert.equal(undone.decisionType, "approve");
  assert.equal(excluded.decisionType, "approve");
});

test("actors aggregate together while supplier, item, unit, and source remain separate", () => {
  const { item } = fixture();
  const events = [
    baseEvent(1),
    baseEvent(2),
    baseEvent(3, "approve", 10, { supplierId: "supplier-two" }),
    baseEvent(4, "approve", 10, { inventoryItemId: "item-two" }),
    baseEvent(5, "approve", 10, { canonicalUnit: "ml" }),
    baseEvent(6, "approve", 10, { recommendationSource: "legacy_client" })
  ];
  const patterns = buildPurchaseDecisionPatterns(events, [item]);
  assert.equal(patterns.length, 5);
  assert.equal(patterns.find((pattern) => pattern.sampleCount === 2)?.exactApprovalCount, 2);
});

test("supplier reassignment makes old evidence non-current while a display rename does not", () => {
  const { item } = fixture();
  const events = Array.from({ length: 5 }, (_, index) => baseEvent(index + 1));
  const renamed = { ...item, supplier_name: "Renamed presentation only" };
  assert.equal(buildPurchaseDecisionPatterns(events, [renamed])[0]!.currentContext, true);
  const reassigned = { ...item, supplier_id: "supplier-two" };
  assert.equal(buildPurchaseDecisionPatterns(events, [reassigned])[0]!.currentContext, false);
});

test("purchase memory is observational and exports no quantity recommendation function", async () => {
  const module = await import("../services/domain/purchaseDecisionMemory");
  assert.equal("recommendQuantityFromPurchaseDecisionPatterns" in module, false);
  assert.equal("applyPurchaseDecisionPattern" in module, false);
});
