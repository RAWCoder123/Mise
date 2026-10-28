/**
 * Operational-findings domain evidence-summary display helpers (MISE-005SK).
 *
 * Pins domain-layer `buildDailyOperationalBrief` finding evidence `summary`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Finding evidence summaries
 * previously Unicode-trimmed and collapsed through shared `boundedText`
 * (`.trim().replace(/\s+/g, " ")`), so NBSP/em-space padding invented a clean
 * single-line summary before the durable `FindingEvidenceReference.summary`
 * stored it (`'\u2003Chicken Breast: 38 lb suggested\u2003'
 * .trim().replace(/\s+/g, " ") === 'Chicken Breast: 38 lb suggested'`).
 * Mid-string Unicode spaces were likewise collapsed into ordinary ASCII
 * spaces, inventing equality with the unpadded summary.
 *
 * Presentation evidence summaries follow the same ASCII C display-prep
 * contract used by operational-findings title (#920 / MISE-005SH),
 * explanation (#921 / MISE-005SI), and recommendedAction (#922 / MISE-005SJ):
 * fold NBSP to a plain space, collapse C-locale `[[:space:]]`, then ASCII
 * space trim. Unicode `String#trim` or Unicode whitespace collapse would
 * strip em-space and other non-C whitespace the hosted COLLATE "C" path
 * leaves alone, inventing a summary the server would not treat as equal.
 * Accents and case are preserved.
 *
 * Complements open operational-findings title tip #920 / MISE-005SH,
 * explanation tip #921 / MISE-005SI, recommendedAction tip #922 / MISE-005SJ,
 * restaurant workspace tip #755 / MISE-005LY, finding-decision evidence
 * summary tip #831 / MISE-005OW, and finding-decision recommended-action tip
 * #832 / MISE-005OX without sharing their helper modules or rewriting those
 * paths. Intentionally does not change other `boundedText` surfaces (`title`,
 * `explanation`, `recommendedAction`, confidence `rationale`, or unmapped
 * menu-item name tokens). Those remain on their existing Unicode-trim
 * contracts in this tip.
 *
 * Evidence summaries are required single-line presentation text on durable
 * finding evidence. Soft empty-after-Unicode-trim still falls back to the
 * caller fallback (prior `boundedText` contract) so a blank insight
 * description cannot invent content, and max length stays 240 to match the
 * prior evidence-summary cap.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for operational-findings evidence summaries. Folds
 * NBSP, collapses C whitespace, ASCII-space trims. Does not Unicode-trim or
 * collapse with a Unicode whitespace class, so em-space padding cannot invent
 * equality with an unpadded evidence summary.
 */
export function canonicalOperationalFindingsEvidenceSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

/**
 * Soft-fallback evidence-summary bound used by `buildDailyOperationalBrief`.
 * Preserves the prior `boundedText(..., 240)` empty→fallback contract while
 * refusing to invent a clean evidence summary via Unicode em-space trim or
 * Unicode whitespace collapse.
 */
export function boundedCanonicalOperationalFindingsEvidenceSummary(
  value: string,
  fallback: string,
  max = 240
): string {
  // Unicode-only spaces (for example em-space alone): prior boundedText treated
  // empty-after-Unicode-trim as fallback. Do not invent a one-character summary.
  if (!value.trim()) {
    return fallback.slice(0, max);
  }
  const canonical = canonicalOperationalFindingsEvidenceSummary(value);
  return (canonical || fallback).slice(0, max);
}
