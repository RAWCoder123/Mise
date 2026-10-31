/**
 * Purchase-authority canonicalUnit identity helpers (MISE-005UT).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evidence.canonicalUnit`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Purchase-authority evidence
 * previously Unicode-trimmed `canonicalUnit` through shared `nullableString` /
 * `boundedString`, so NBSP/em-space padding invented a clean unit token before
 * it was stored as purchase-authority evidence
 * (`'\u2003each\u2003'.trim() === 'each'`). Soft empty / Unicode-only space also
 * collapsed through Unicode trim into the intentional soft-null optional
 * contract.
 *
 * These are purchase-authority **canonical unit tokens** only — not
 * inventory-count timestamps (#983 / MISE-005US), not evaluation timestamps
 * (#982 / MISE-005UR), not blocker descriptions (#981 / MISE-005UQ), not
 * metadata values (#819 / MISE-005OK), not metadata keys (#818 / MISE-005OJ),
 * not recipe-revision keys (#807 / MISE-005NY), not countEventId
 * (#806 / MISE-005NX), not inventoryItemId (#805 / MISE-005NW), not
 * recommendationId (#804 / MISE-005NV), not supplierId (#803 / MISE-005NU),
 * and not provider-window siblings. Soft empty / non-string stay `null`
 * (`nullableString` contract). Inventing / over-long / control-bearing tokens
 * throw so padded unit tokens cannot invent durable `canonicalUnit` identity.
 * Ordinary ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open purchase-authority tips #983 / MISE-005US, #982 /
 * MISE-005UR, #981 / MISE-005UQ, #819 / MISE-005OK, #818 / MISE-005OJ,
 * #807 / MISE-005NY, #806 / MISE-005NX, #805 / MISE-005NW, #804 / MISE-005NV,
 * and #803 / MISE-005NU without sharing their helper modules or rewriting
 * those paths. Intentionally does not change other `boundedString` /
 * `nullableString` surfaces (`recommendationId`, `inventoryItemId`,
 * `supplierId`, `countEventId`, `countedAt`, provider windows, recipe-revision
 * keys, blocker descriptions, metadata keys/values, or evaluatedAt). Those
 * remain on their existing Unicode-trim contracts in this tip.
 *
 * Max length stays 20 to match the prior `nullableString(..., 20)` /
 * `boundedString(..., 20)` cap.
 */

const MAX_PURCHASE_AUTHORITY_CANONICAL_UNIT = 20;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized canonical unit token before it is stored as
 * durable purchase-authority evidence.
 */
export function asciiTrimPurchaseAuthorityCanonicalUnit(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority canonicalUnit token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityCanonicalUnit(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityCanonicalUnit(value);
  if (!trimmed) return null;
  if (trimmed.length > MAX_PURCHASE_AUTHORITY_CANONICAL_UNIT) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed canonicalUnit normalize for `normalizePurchaseAuthorityResult`.
 * Preserves soft empty / non-string → `null` (`nullableString` contract) while
 * refusing Unicode-padded tokens that would invent a durable unit identity.
 * Error contract: `Purchase authority canonicalUnit is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityCanonicalUnit(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const canonical = canonicalizePurchaseAuthorityCanonicalUnit(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Purchase authority canonicalUnit is invalid.");
}
