/**
 * Operational-findings domain explanation display helpers (MISE-005SI).
 *
 * Pins domain-layer `buildDailyOperationalBrief` finding `explanation` outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Finding explanations previously
 * Unicode-trimmed and collapsed through shared `boundedText`
 * (`.trim().replace(/\s+/g, " ")`), so NBSP/em-space padding invented a clean
 * single-line explanation before the durable `OperationalFinding.explanation`
 * stored it
 * (`'\u2003Chicken Breast has less than one service day of projected coverage.\u2003'
 * .trim().replace(/\s+/g, " ") ===
 * 'Chicken Breast has less than one service day of projected coverage.'`).
 * Mid-string Unicode spaces were likewise collapsed into ordinary ASCII spaces,
 * inventing equality with the unpadded explanation.
 *
 * Presentation explanations follow the same ASCII C display-prep contract used
 * by operational-findings title (#920 / MISE-005SH) and related single-line
 * prep: fold NBSP to a plain space, collapse C-locale `[[:space:]]`, then ASCII
 * space trim. Unicode `String#trim` or Unicode whitespace collapse would strip
 * em-space and other non-C whitespace the hosted COLLATE "C" path leaves alone,
 * inventing an explanation the server would not treat as equal. Accents and
 * case are preserved.
 *
 * Complements open operational-findings title tip #920 / MISE-005SH,
 * restaurant workspace tip #755 / MISE-005LY, finding-decision evidence summary
 * tip #831 / MISE-005OW, and finding-decision recommended-action tip #832 /
 * MISE-005OX without sharing their helper modules or rewriting those paths.
 * Intentionally does not change other `boundedText` surfaces (`title`,
 * `recommendedAction`, evidence `summary`, confidence `rationale`, or unmapped
 * menu-item name tokens). Those remain on their existing Unicode-trim contracts
 * in this tip.
 *
 * Explanations are required single-line presentation text on the durable
 * finding. Soft empty-after-Unicode-trim still falls back to the caller
 * fallback (prior `boundedText` contract) so a blank insight explanation cannot
 * invent content, and max length stays 240 to match the prior explanation cap.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for operational-findings explanations. Folds NBSP,
 * collapses C whitespace, ASCII-space trims. Does not Unicode-trim or collapse
 * with a Unicode whitespace class, so em-space padding cannot invent equality
 * with an unpadded explanation.
 */
export function canonicalOperationalFindingsExplanation(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

/**
 * Soft-fallback explanation bound used by `buildDailyOperationalBrief`.
 * Preserves the prior `boundedText(..., 240)` empty→fallback contract while
 * refusing to invent a clean explanation via Unicode em-space trim or Unicode
 * whitespace collapse.
 */
export function boundedCanonicalOperationalFindingsExplanation(
  value: string,
  fallback: string,
  max = 240
): string {
  // Unicode-only spaces (for example em-space alone): prior boundedText treated
  // empty-after-Unicode-trim as fallback. Do not invent a one-character explanation.
  if (!value.trim()) {
    return fallback.slice(0, max);
  }
  const canonical = canonicalOperationalFindingsExplanation(value);
  return (canonical || fallback).slice(0, max);
}
