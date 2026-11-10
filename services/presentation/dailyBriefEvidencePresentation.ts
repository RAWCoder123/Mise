import type { OperationalFinding } from "../domain/operationalFindings";

/** Bounded evidence shown under a Daily Brief finding before progressive disclosure expands. */
export const DAILY_BRIEF_EVIDENCE_PREVIEW_LIMIT = 2;
export const DAILY_BRIEF_EVIDENCE_MAX = 3;

export interface PresentedDailyBriefFindingEvidence {
  confidenceRationale: string | null;
  evidenceItems: string[];
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Selects grounded finding evidence already computed on the daily operational brief.
 * Does not invent confidence claims, summaries, or new evidence rows.
 */
export function presentDailyBriefFindingEvidence(
  finding: OperationalFinding
): PresentedDailyBriefFindingEvidence {
  const evidenceItems = finding.evidence
    .map((entry) => entry.summary.trim())
    .filter(Boolean)
    .slice(0, DAILY_BRIEF_EVIDENCE_MAX);

  return {
    confidenceRationale: trimOrNull(finding.confidence.rationale),
    evidenceItems
  };
}

export function dailyBriefEvidenceHasStructuredDetail(
  evidence: PresentedDailyBriefFindingEvidence
): boolean {
  return Boolean(evidence.confidenceRationale || evidence.evidenceItems.length > 0);
}
