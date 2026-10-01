import assert from "node:assert/strict";
import test from "node:test";

import type { OperatingBriefApprovalCard } from "../services/domain/operatingBrief";
import {
  HOME_APPROVAL_EVIDENCE_MAX,
  homeApprovalEvidenceHasStructuredDetail,
  presentHomeApprovalEvidence
} from "../services/presentation/homeApprovalPresentation";

function card(overrides: Partial<OperatingBriefApprovalCard> = {}): OperatingBriefApprovalCard {
  return {
    id: "approval_rec_1",
    recommendationId: "rec_1",
    actionId: null,
    orderId: null,
    findingId: null,
    title: "Approve Chicken thighs reorder",
    decision: "Approve 18 lb from Metro Produce",
    whyItMatters: "Lunch usage was 24% above forecast.",
    recommendedAction: "Order 18 lb from Metro Produce",
    deadline: null,
    confidence: 0.72,
    confidenceRationale: "Based on an inventory count updated within 24 hours.",
    expectedOperationalImpact: "Protects Chicken thighs availability through the next service window.",
    estimatedFinancialImpact: null,
    riskIfIgnored: "Ignoring this can force an 86 or emergency purchase for Chicken thighs.",
    workAlreadyCompleted: [
      "Compared current quantity with mapped demand",
      "Prepared a recommended reorder quantity",
      "Checked supplier pack size",
      "Extra evidence that should be capped"
    ],
    supplierName: "Metro Produce",
    quantity: 18,
    unit: "lb",
    ...overrides
  };
}

test("presentHomeApprovalEvidence surfaces confidence, risk, impact, and capped evidence", () => {
  const presented = presentHomeApprovalEvidence(card());
  assert.equal(presented.confidenceScore, 0.72);
  assert.match(presented.confidenceRationale ?? "", /within 24 hours/);
  assert.match(presented.riskIfIgnored ?? "", /emergency purchase/);
  assert.match(presented.expectedOperationalImpact ?? "", /next service window/);
  assert.equal(presented.evidenceItems.length, HOME_APPROVAL_EVIDENCE_MAX);
  assert.equal(presented.evidenceItems.includes("Extra evidence that should be capped"), false);
  assert.equal(homeApprovalEvidenceHasStructuredDetail(presented), true);
});

test("presentHomeApprovalEvidence fails closed on blank and non-finite values", () => {
  const presented = presentHomeApprovalEvidence(
    card({
      confidence: Number.NaN,
      confidenceRationale: "   ",
      expectedOperationalImpact: "",
      riskIfIgnored: "   ",
      workAlreadyCompleted: ["", "  ", "Compared current quantity with mapped demand"]
    })
  );
  assert.equal(presented.confidenceScore, null);
  assert.equal(presented.confidenceRationale, null);
  assert.equal(presented.expectedOperationalImpact, null);
  assert.equal(presented.riskIfIgnored, null);
  assert.deepEqual(presented.evidenceItems, ["Compared current quantity with mapped demand"]);
  assert.equal(homeApprovalEvidenceHasStructuredDetail(presented), true);
});

test("presentHomeApprovalEvidence clamps confidence into 0..1", () => {
  assert.equal(presentHomeApprovalEvidence(card({ confidence: 1.4 })).confidenceScore, 1);
  assert.equal(presentHomeApprovalEvidence(card({ confidence: -0.2 })).confidenceScore, 0);
});

test("homeApprovalEvidenceHasStructuredDetail is false without grounded fields", () => {
  const presented = presentHomeApprovalEvidence(
    card({
      confidence: null,
      confidenceRationale: null,
      expectedOperationalImpact: "",
      riskIfIgnored: "",
      workAlreadyCompleted: []
    })
  );
  assert.equal(homeApprovalEvidenceHasStructuredDetail(presented), false);
});
