/**
 * Purchase-authority blocker description display helpers (MISE-005UQ).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` blocker `description`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Blocker descriptions previously
 * Unicode-trimmed through shared `boundedString` (`.trim().slice(0, 240)`), so
 * NBSP/em-space padding invented a clean single-line description before the
 * durable `PurchaseAuthorityBlocker.description` stored it
 * (`'\u2003Need a fresh count before approval\u2003'.trim() ===
 * 'Need a fresh count before approval'`). Soft empty / Unicode-only space still
 * falls through to the intentional English
 * `"Purchase evidence needs attention."` fallback.
 *
 * Presentation descriptions follow the same ASCII C display-prep contract used
 * by operational-findings explanations (#921 / MISE-005SI) and related
 * single-line free-text prep: fold NBSP to a plain space, collapse C-locale
 * `[[:space:]]`, then ASCII space trim. Unicode `String#trim` or Unicode
 * whitespace collapse would strip em-space and other non-C whitespace the
 * hosted COLLATE "C" path leaves alone, inventing a description the server
 * would not treat as equal. Accents and case are preserved.
 *
 * Complements open purchase-authority metadata-value tip #819 / MISE-005OK,
 * metadata-key tip #818 / MISE-005OJ, recipe-revision tip #807 / MISE-005NY,
 * countEventId tip #806 / MISE-005NX, inventoryItemId tip #805 / MISE-005NW,
 * recommendationId tip #804 / MISE-005NV, and supplierId tip #803 / MISE-005NU
 * without sharing their helper modules or rewriting those paths. Open tip
 * #819 / MISE-005OK explicitly left blocker descriptions on their Unicode-trim
 * contract. Intentionally does not change other `boundedString` /
 * `nullableString` surfaces (`recommendationId`, `inventoryItemId`,
 * `supplierId`, `countEventId`, `countedAt`, `canonicalUnit`, recipe-revision
 * keys, metadata map keys/values, or evaluatedAt). Those remain on their
 * existing Unicode-trim contracts in this tip.
 *
 * Descriptions are required single-line presentation text on durable blockers.
 * Soft empty-after-Unicode-trim still falls back to the caller fallback (prior
 * `boundedString(...) || "Purchase evidence needs attention."` contract) so a
 * blank description cannot invent content, and max length stays 240 to match
 * the prior description cap (silent truncate preserved).
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;

/**
 * Canonical display text for purchase-authority blocker descriptions. Folds
 * NBSP, collapses C whitespace, ASCII-space trims. Does not Unicode-trim or
 * collapse with a Unicode whitespace class, so em-space padding cannot invent
 * equality with an unpadded description.
 */
export function canonicalPurchaseAuthorityDescription(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

/**
 * Soft-fallback description bound used by `normalizePurchaseAuthorityResult`.
 * Preserves the prior `boundedString(..., 240) || fallback` empty→fallback
 * contract while refusing to invent a clean description via Unicode em-space
 * trim or Unicode whitespace collapse. Non-string values soft-empty to the
 * fallback (prior `boundedString` non-string → `""` contract).
 */
export function boundedCanonicalPurchaseAuthorityDescription(
  value: unknown,
  fallback = "Purchase evidence needs attention.",
  max = 240
): string {
  if (typeof value !== "string") {
    return fallback.slice(0, max);
  }
  // Unicode-only spaces (for example em-space alone): prior boundedString
  // treated empty-after-Unicode-trim as fallback. Do not invent a one-character
  // description from padding.
  if (!value.trim()) {
    return fallback.slice(0, max);
  }
  const canonical = canonicalPurchaseAuthorityDescription(value);
  return (canonical || fallback).slice(0, max);
}
