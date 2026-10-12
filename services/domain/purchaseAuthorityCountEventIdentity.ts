/**
 * Purchase-authority countEventId identity helpers (MISE-005NX).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evidence.countEventId`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Purchase-authority evidence
 * previously Unicode-trimmed `countEventId` through shared `nullableString` /
 * `boundedString`, so NBSP/em-space padding invented a valid durable count-event
 * identity before it was stored as purchase-authority evidence.
 *
 * Complements open purchase-authority inventoryItemId tip #805 / MISE-005NW,
 * recommendationId tip #804 / MISE-005NV, and supplierId tip #803 / MISE-005NU
 * without sharing their helper modules or rewriting those paths. Intentionally
 * does not change other `boundedString` / `nullableString` surfaces
 * (`recommendationId`, `inventoryItemId`, `supplierId`, `countedAt`,
 * `canonicalUnit`, recipe-revision keys, blocker descriptions, metadata
 * keys/values, or evaluatedAt). Those remain on their existing Unicode-trim
 * contracts in this tip.
 *
 * Count-event identities are UUID-shaped on the hosted path but may be other
 * durable tokens in fixtures. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Max length stays
 * 80 to match the prior `nullableString(..., 80)` / `boundedString(..., 80)`
 * cap. Empty-after-trim remains soft-null (`null`) so missing count-event
 * evidence stays an optional soft empty field without throwing.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority count-event identity
 * before it is stored as durable purchase-authority evidence.
 */
export function asciiTrimPurchaseAuthorityCountEventToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority countEventId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityCountEventId(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityCountEventToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed countEventId normalize for `normalizePurchaseAuthorityResult`.
 * Preserves soft empty / non-string → `null` (`nullableString` contract) while
 * refusing Unicode-padded tokens that would invent a durable count-event
 * identity. Error contract: `Purchase authority countEventId is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityCountEventId(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const canonical = canonicalizePurchaseAuthorityCountEventId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Purchase authority countEventId is invalid.");
}
