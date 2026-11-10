import assert from "node:assert/strict";
import test from "node:test";

import type { OperationalFinding } from "../services/domain/operationalFindings";
import {
  DAILY_BRIEF_EVIDENCE_MAX,
  dailyBriefEvidenceHasStructuredDetail,
  presentDailyBriefFindingEvidence
} from "../services/presentation/dailyBriefEvidencePresentation";

function finding(overrides: Partial<OperationalFinding> = {}): OperationalFinding {
  return {
    id: "finding:inventory:low-stock",
    restaurantId: "restaurant-a",
    category: "inventory",
    severity: "warning",
    priority: "now",
    title: "Low basil",
    explanation: "Projected coverage is thin.",
    confidence: {
      score: 0.82,
      rationale: "Based on an inventory count updated within 24 hours."
    },
    evidence: [
      {
        type: "inventory_item",
        id: "item-basil",
        observedAt: "2026-07-28T12:00:00.000Z",
        summary: "On hand 0.4 kg"
      },
      {
        type: "purchase_recommendation",
        id: "rec-basil",
        observedAt: "2026-07-28T12:00:00.000Z",
        summary: "Suggested reorder for dinner coverage"
      },
      {
        type: "insight",
        id: "insight-basil",
        observedAt: "2026-07-28T12:00:00.000Z",
        summary: "Usage above seven-day baseline"
      },
      {
        type: "pos_sale",
        id: "sale-basil",
        observedAt: "2026-07-28T12:00:00.000Z",
        summary: "Extra evidence that should be capped"
      }
    ],
    affectedWorkflow: "inventory",
    recommendedAction: "Count basil before dinner service",
    sourceWindow: {
      start: "2026-07-27T00:00:00.000Z",
      end: "2026-07-28T00:00:00.000Z"
    },
    generatedAt: "2026-07-28T08:00:00.000Z",
    freshness: {
      state: "fresh",
      asOf: "2026-07-28T08:00:00.000Z",
      staleAfter: "2026-07-30T08:00:00.000Z",
      missingData: []
    },
    managerFeedback: {
      state: "unreviewed",
      decisionId: null,
      recordedAt: null,
      effectiveRecommendedAction: "Count basil before dinner service"
    },
    policyVersion: "beta-findings-v1",
    ...overrides
  };
}

test("presentDailyBriefFindingEvidence surfaces rationale and capped evidence summaries", () => {
  const presented = presentDailyBriefFindingEvidence(finding());
  assert.match(presented.confidenceRationale ?? "", /within 24 hours/);
  assert.equal(presented.evidenceItems.length, DAILY_BRIEF_EVIDENCE_MAX);
  assert.equal(presented.evidenceItems.includes("Extra evidence that should be capped"), false);
  assert.equal(dailyBriefEvidenceHasStructuredDetail(presented), true);
});

test("presentDailyBriefFindingEvidence fails closed on blank rationale and summaries", () => {
  const presented = presentDailyBriefFindingEvidence(
    finding({
      confidence: { score: 0.4, rationale: "   " },
      evidence: [
        {
          type: "inventory_item",
          id: "item-basil",
          observedAt: "2026-07-28T12:00:00.000Z",
          summary: ""
        },
        {
          type: "insight",
          id: "insight-basil",
          observedAt: "2026-07-28T12:00:00.000Z",
          summary: "  "
        },
        {
          type: "data_gap",
          id: "gap-basil",
          observedAt: "2026-07-28T12:00:00.000Z",
          summary: "Missing recipe mapping for pesto"
        }
      ]
    })
  );
  assert.equal(presented.confidenceRationale, null);
  assert.deepEqual(presented.evidenceItems, ["Missing recipe mapping for pesto"]);
  assert.equal(dailyBriefEvidenceHasStructuredDetail(presented), true);
});

test("dailyBriefEvidenceHasStructuredDetail is false without grounded fields", () => {
  const presented = presentDailyBriefFindingEvidence(
    finding({
      confidence: { score: 0.5, rationale: "" },
      evidence: []
    })
  );
  assert.equal(presented.confidenceRationale, null);
  assert.deepEqual(presented.evidenceItems, []);
  assert.equal(dailyBriefEvidenceHasStructuredDetail(presented), false);
});
