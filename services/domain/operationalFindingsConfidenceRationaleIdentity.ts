/**
 * Operational-findings domain confidence rationale display helpers
 * (MISE-005SM).
 *
 * Pins domain-layer `buildDailyOperationalBrief` finding confidence `rationale`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Confidence rationales previously
 * Unicode-trimmed and collapsed through shared `boundedText` inside
 * `boundedConfidence` (`.trim().replace(/\s+/g, " ")`), so NBSP/em-space
 * padding invented a clean single-line rationale before the durable
 * `OperationalFinding.confidence.rationale` stored it
 * (`'\u2003Current tenant inventory, a verified canonical unit, and a menu mapping support this quantity.\u2003'.trim().replace(/\s+/g, " ") ===
 * 'Current tenant inventory, a verified canonical unit, and a menu mapping support this quantity.'`).
 * Mid-string Unicode spaces were likewise collapsed into ordinary ASCII
 * spaces, inventing equality with the unpadded rationale.
 *
 * Presentation confidence rationales follow the same ASCII C display-prep
 * contract used by operational-findings title (#920 / MISE-005SH),
 * explanation (#921 / MISE-005SI), recommendedAction (#922 / MISE-005SJ),
 * evidence summary (#923 / MISE-005SK), and unmapped menu-item name (#924 /
 * MISE-005SL): fold NBSP to a plain space, collapse C-locale `[[:space:]]`,
 * then ASCII space trim. Unicode `String#trim` or Unicode whitespace collapse
 * would strip em-space and other non-C whitespace the hosted COLLATE "C" path
 * leaves alone, inventing a rationale the server would not treat as equal.
 * Accents and case are preserved.
 *
 * Complements open operational-findings title tip #920 / MISE-005SH,
 * explanation tip #921 / MISE-005SI, recommendedAction tip #922 / MISE-005SJ,
 * evidence summary tip #923 / MISE-005SK, unmapped menu-item name tip #924 /
 * MISE-005SL, restaurant workspace tip #755 / MISE-005LY, finding-decision
 * evidence summary tip #831 / MISE-005OW, and finding-decision
 * recommended-action tip #832 / MISE-005OX without sharing their helper
 * modules or rewriting those paths. Intentionally does not change other
 * `boundedText` surfaces (`title`, `explanation`, `recommendedAction`,
 * evidence `summary`, or unmapped menu-item name tokens). Those remain on
 * their existing Unicode-trim contracts in this tip.
 *
 * Confidence rationales are required single-line presentation text on the
 * durable finding. Soft empty-after-Unicode-trim still falls back to the
 * caller fallback (prior `boundedText` contract) so a blank rationale cannot
 * invent content, and max length stays 180 to match the prior confidence
 * rationale cap.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for operational-findings confidence rationales.
 * Folds NBSP, collapses C whitespace, ASCII-space trims. Does not Unicode-trim
 * or collapse with a Unicode whitespace class, so em-space padding cannot
 * invent equality with an unpadded rationale.
 */
export function canonicalOperationalFindingsConfidenceRationale(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

/**
 * Soft-fallback confidence rationale bound used by `boundedConfidence` inside
 * `buildDailyOperationalBrief`. Preserves the prior `boundedText(..., 180)`
 * empty→fallback contract while refusing to invent a clean rationale via
 * Unicode em-space trim or Unicode whitespace collapse.
 */
export function boundedCanonicalOperationalFindingsConfidenceRationale(
  value: string,
  fallback: string,
  max = 180
): string {
  // Unicode-only spaces (for example em-space alone): prior boundedText treated
  // empty-after-Unicode-trim as fallback. Do not invent a one-character rationale.
  if (!value.trim()) {
    return fallback.slice(0, max);
  }
  const canonical = canonicalOperationalFindingsConfidenceRationale(value);
  return (canonical || fallback).slice(0, max);
}
