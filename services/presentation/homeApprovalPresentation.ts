import type { OperatingBriefApprovalCard } from "../domain/operatingBrief";

/** Bounded evidence shown under a Home approval card before progressive disclosure expands. */
export const HOME_APPROVAL_EVIDENCE_PREVIEW_LIMIT = 2;
export const HOME_APPROVAL_EVIDENCE_MAX = 3;

export interface PresentedHomeApprovalEvidence {
  confidenceScore: number | null;
  confidenceRationale: string | null;
  riskIfIgnored: string | null;
  expectedOperationalImpact: string | null;
  evidenceItems: string[];
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Selects grounded decision evidence already computed on the operating brief.
 * Does not invent confidence, risk, or completed-work claims.
 */
export function presentHomeApprovalEvidence(
  card: OperatingBriefApprovalCard
): PresentedHomeApprovalEvidence {
  const confidenceScore =
    typeof card.confidence === "number" && Number.isFinite(card.confidence)
      ? Math.min(1, Math.max(0, card.confidence))
      : null;

  const evidenceItems = card.workAlreadyCompleted
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, HOME_APPROVAL_EVIDENCE_MAX);

  return {
    confidenceScore,
    confidenceRationale: trimOrNull(card.confidenceRationale),
    riskIfIgnored: trimOrNull(card.riskIfIgnored),
    expectedOperationalImpact: trimOrNull(card.expectedOperationalImpact),
    evidenceItems
  };
}

export function homeApprovalEvidenceHasStructuredDetail(
  evidence: PresentedHomeApprovalEvidence
): boolean {
  return Boolean(
    evidence.confidenceScore !== null ||
      evidence.confidenceRationale ||
      evidence.riskIfIgnored ||
      evidence.expectedOperationalImpact ||
      evidence.evidenceItems.length > 0
  );
}
