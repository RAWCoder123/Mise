/**
 * Operational-findings domain unmapped menu-item name display helpers
 * (MISE-005SL).
 *
 * Pins domain-layer `buildDailyOperationalBrief` unmapped-sale menu-item name
 * tokens outside the repository graph so Node tests can exercise inventing
 * proofs without loading Supabase or demo storage. Unmapped menu-item names
 * previously Unicode-trimmed and collapsed through shared `boundedText`
 * (`.trim().replace(/\s+/g, " ")`), so NBSP/em-space padding invented a clean
 * single-line name before the durable finding freshness `missingData` token
 * `menu_mapping:${name}` stored it
 * (`'\u2003Chicken Bowl\u2003'.trim().replace(/\s+/g, " ") === 'Chicken Bowl'`).
 * Mid-string Unicode spaces were likewise collapsed into ordinary ASCII
 * spaces, inventing equality with the unpadded name.
 *
 * Presentation unmapped menu-item names follow the same ASCII C display-prep
 * contract used by operational-findings title (#920 / MISE-005SH),
 * explanation (#921 / MISE-005SI), recommendedAction (#922 / MISE-005SJ), and
 * evidence summary (#923 / MISE-005SK): fold NBSP to a plain space, collapse
 * C-locale `[[:space:]]`, then ASCII space trim. Unicode `String#trim` or
 * Unicode whitespace collapse would strip em-space and other non-C whitespace
 * the hosted COLLATE "C" path leaves alone, inventing a name the server would
 * not treat as equal. Accents and case are preserved.
 *
 * Complements open operational-findings title tip #920 / MISE-005SH,
 * explanation tip #921 / MISE-005SI, recommendedAction tip #922 / MISE-005SJ,
 * evidence summary tip #923 / MISE-005SK, restaurant workspace tip #755 /
 * MISE-005LY, finding-decision evidence summary tip #831 / MISE-005OW,
 * finding-decision recommended-action tip #832 / MISE-005OX, and pilot
 * readiness sale item-name tip #875 / MISE-005QO without sharing their helper
 * modules or rewriting those paths. Intentionally does not change other
 * `boundedText` surfaces (`title`, `explanation`, `recommendedAction`,
 * evidence `summary`, or confidence `rationale`). Those remain on their
 * existing Unicode-trim contracts in this tip.
 *
 * Unmapped menu-item names are required single-line presentation tokens on
 * durable finding freshness missing-data keys. Soft empty-after-Unicode-trim
 * still falls back to the caller fallback (prior `boundedText` contract) so a
 * blank sale item name cannot invent content, and max length stays 80 to match
 * the prior unmapped menu-item name cap.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for operational-findings unmapped menu-item names.
 * Folds NBSP, collapses C whitespace, ASCII-space trims. Does not Unicode-trim
 * or collapse with a Unicode whitespace class, so em-space padding cannot
 * invent equality with an unpadded menu-item name.
 */
export function canonicalOperationalFindingsUnmappedMenuItemName(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

/**
 * Soft-fallback unmapped menu-item name bound used by
 * `buildDailyOperationalBrief`. Preserves the prior `boundedText(..., 80)`
 * empty→fallback contract while refusing to invent a clean menu-item name via
 * Unicode em-space trim or Unicode whitespace collapse.
 */
export function boundedCanonicalOperationalFindingsUnmappedMenuItemName(
  value: string,
  fallback: string,
  max = 80
): string {
  // Unicode-only spaces (for example em-space alone): prior boundedText treated
  // empty-after-Unicode-trim as fallback. Do not invent a one-character name.
  if (!value.trim()) {
    return fallback.slice(0, max);
  }
  const canonical = canonicalOperationalFindingsUnmappedMenuItemName(value);
  return (canonical || fallback).slice(0, max);
}
