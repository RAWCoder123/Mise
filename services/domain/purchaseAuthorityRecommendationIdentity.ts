/**
 * Purchase-authority recommendationId identity helpers (MISE-005NV).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evidence.recommendationId`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Purchase-authority evidence
 * previously Unicode-trimmed `recommendationId` through shared `boundedString`,
 * so NBSP/em-space padding invented a valid durable recommendation identity
 * before it was stored as purchase-authority evidence.
 *
 * Complements open purchase-authority supplierId tip #803 / MISE-005NU without
 * sharing its helper module or rewriting that path. Intentionally does not
 * change other `boundedString` surfaces (`supplierId`, `inventoryItemId`,
 * `countEventId`, `canonicalUnit`, recipe-revision keys, blocker descriptions,
 * metadata keys/values, or evaluatedAt). Those remain on their existing
 * Unicode-trim contracts in this tip.
 *
 * Recommendation identities are UUID-shaped on the hosted path but may be
 * other durable tokens in fixtures. Only ASCII end trim is pinned; case is
 * left unchanged so unknown casing still fails closed downstream. Max length
 * stays 80 to match the prior `boundedString(..., 80)` cap. Empty-after-trim
 * remains soft-empty string (`""`) so missing recommendation evidence stays a
 * soft empty field without throwing.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority recommendation identity
 * before it is stored as durable purchase-authority evidence.
 */
export function asciiTrimPurchaseAuthorityRecommendationToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority recommendationId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityRecommendationId(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityRecommendationToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed recommendationId normalize for `normalizePurchaseAuthorityResult`.
 * Preserves soft empty / non-string → `""` (`boundedString` contract) while
 * refusing Unicode-padded tokens that would invent a durable recommendation
 * identity. Error contract: `Purchase authority recommendationId is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityRecommendationId(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }
  const canonical = canonicalizePurchaseAuthorityRecommendationId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → "".
  if (!value.trim()) return "";
  throw new Error("Purchase authority recommendationId is invalid.");
}
