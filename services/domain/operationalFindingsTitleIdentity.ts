/**
 * Operational-findings domain title display helpers (MISE-005SH).
 *
 * Pins domain-layer `buildDailyOperationalBrief` finding `title` outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Finding titles previously Unicode-trimmed and
 * collapsed through shared `boundedText` (`.trim().replace(/\s+/g, " ")`), so
 * NBSP/em-space padding invented a clean single-line title before the durable
 * `OperationalFinding.title` stored it
 * (`'\u2003Review chicken coverage\u2003'.trim().replace(/\s+/g, " ") ===
 * 'Review chicken coverage'`). Mid-string Unicode spaces were likewise collapsed
 * into ordinary ASCII spaces, inventing equality with the unpadded title.
 *
 * Presentation titles follow the same ASCII C display-prep contract used by
 * restaurant-tasks title (#822 / MISE-005ON) and related supplier display-name
 * prep: fold NBSP to a plain space, collapse C-locale `[[:space:]]`, then ASCII
 * space trim. Unicode `String#trim` or Unicode whitespace collapse would strip
 * em-space and other non-C whitespace the hosted COLLATE "C" path leaves alone,
 * inventing a title the server would not treat as equal. Accents and case are
 * preserved.
 *
 * Complements open operational-findings restaurant workspace tip #755 /
 * MISE-005LY, finding-decision evidence summary tip #831 / MISE-005OW, and
 * finding-decision recommended-action tip #832 / MISE-005OX without sharing
 * their helper modules or rewriting those paths. Intentionally does not change
 * other `boundedText` surfaces (`explanation`, `recommendedAction`, evidence
 * `summary`, confidence `rationale`, or unmapped menu-item name tokens). Those
 * remain on their existing Unicode-trim contracts in this tip.
 *
 * Titles are required single-line presentation text on the durable finding.
 * Soft empty-after-Unicode-trim still falls back to the caller fallback (prior
 * `boundedText` contract) so a blank insight title cannot invent content, and
 * max length stays 120 to match the prior title cap.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for operational-findings titles. Folds NBSP, collapses
 * C whitespace, ASCII-space trims. Does not Unicode-trim or collapse with a
 * Unicode whitespace class, so em-space padding cannot invent equality with an
 * unpadded title.
 */
export function canonicalOperationalFindingsTitle(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

/**
 * Soft-fallback title bound used by `buildDailyOperationalBrief`. Preserves the
 * prior `boundedText(..., 120)` empty→fallback contract while refusing to invent
 * a clean title via Unicode em-space trim or Unicode whitespace collapse.
 */
export function boundedCanonicalOperationalFindingsTitle(
  value: string,
  fallback: string,
  max = 120
): string {
  // Unicode-only spaces (for example em-space alone): prior boundedText treated
  // empty-after-Unicode-trim as fallback. Do not invent a one-character title.
  if (!value.trim()) {
    return fallback.slice(0, max);
  }
  const canonical = canonicalOperationalFindingsTitle(value);
  return (canonical || fallback).slice(0, max);
}
