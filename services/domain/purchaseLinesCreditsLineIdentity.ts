/**
 * Purchase-lines creditsLineId identity helpers (MISE-005NT).
 *
 * Pins domain-layer `normalizePurchaseLineInput` `creditsLineId` outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Credit linkage previously Unicode-trimmed
 * `creditsLineId`, so NBSP/em-space padding invented a valid durable offset
 * reference before ledger ingestion or correction writes.
 *
 * Complements open purchase-line restaurant tip #728 / MISE-005KY, lineId tip
 * #764 / MISE-005MH, and source-document tip #768 / MISE-005ML without sharing
 * their helper modules or rewriting those paths.
 *
 * Intentionally does not change application `restaurantId.trim()`,
 * `lineId.trim()`, or `sourceDocumentReference.trim()`, and does not rewrite
 * other `normalizePurchaseLineInput` field trim surfaces (`boundedText`,
 * dates, currency, pack size, and description normalization).
 *
 * Credited line IDs are UUID-shaped on the hosted path but may be other
 * durable tokens in fixtures. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Max length stays
 * 128 to match sibling purchase-line object identity. Empty-after-trim remains
 * soft-null — an unmatched credit is ordinary and fully recordable.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-line creditsLineId before it is
 * stored as durable credit-offset authority.
 */
export function asciiTrimPurchaseLinesCreditsLineToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-lines creditsLineId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseLinesCreditsLineId(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseLinesCreditsLineToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed creditsLineId normalize for `normalizePurchaseLineInput`.
 * Preserves soft empty → null (`creditsLineId?.trim() || null`) while
 * refusing Unicode-padded tokens that would invent a durable credit-offset
 * identity. Null/undefined remain null (optional stated link).
 * Error contract: `Purchase line creditsLineId is invalid.`
 */
export function normalizeCanonicalPurchaseLinesCreditsLineId(
  value: unknown
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Purchase line creditsLineId is invalid.");
  }
  const canonical = canonicalizePurchaseLinesCreditsLineId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Purchase line creditsLineId is invalid.");
}
