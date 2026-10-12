/**
 * Purchase-authority supplierId identity helpers (MISE-005NU).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evidence.supplierId`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Purchase-authority evidence
 * previously Unicode-trimmed `supplierId` through shared `boundedString`, so
 * NBSP/em-space padding invented a valid durable supplier identity used as
 * purchase-authority readiness authority.
 *
 * Intentionally does not change other `boundedString` surfaces
 * (`recommendationId`, `inventoryItemId`, `countEventId`, `canonicalUnit`,
 * recipe-revision keys, blocker descriptions, metadata keys/values, or
 * evaluatedAt). Those remain on their existing Unicode-trim contracts in this
 * tip.
 *
 * Supplier identities are UUID-shaped on the hosted path but may be other
 * durable tokens in fixtures. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Max length stays
 * 80 to match the prior `boundedString(..., 80)` cap. Empty-after-trim remains
 * soft-empty string (`""`) so missing supplier evidence still fails readiness
 * via `Boolean(supplierId)` without throwing.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority supplier identity before
 * it is stored as durable purchase-authority evidence.
 */
export function asciiTrimPurchaseAuthoritySupplierToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority supplierId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthoritySupplierId(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthoritySupplierToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed supplierId normalize for `normalizePurchaseAuthorityResult`.
 * Preserves soft empty / non-string → `""` (`boundedString` contract) while
 * refusing Unicode-padded tokens that would invent a durable supplier
 * identity. Error contract: `Purchase authority supplierId is invalid.`
 */
export function normalizeCanonicalPurchaseAuthoritySupplierId(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }
  const canonical = canonicalizePurchaseAuthoritySupplierId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → "".
  if (!value.trim()) return "";
  throw new Error("Purchase authority supplierId is invalid.");
}
