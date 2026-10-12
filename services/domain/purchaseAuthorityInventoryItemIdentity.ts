/**
 * Purchase-authority inventoryItemId identity helpers (MISE-005NW).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evidence.inventoryItemId`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Purchase-authority evidence
 * previously Unicode-trimmed `inventoryItemId` through shared `boundedString`,
 * so NBSP/em-space padding invented a valid durable inventory-item identity
 * before it was stored as purchase-authority evidence.
 *
 * Complements open purchase-authority recommendationId tip #804 / MISE-005NV
 * and supplierId tip #803 / MISE-005NU without sharing their helper modules or
 * rewriting those paths. Intentionally does not change other `boundedString`
 * surfaces (`recommendationId`, `supplierId`, `countEventId`, `canonicalUnit`,
 * recipe-revision keys, blocker descriptions, metadata keys/values, or
 * evaluatedAt). Those remain on their existing Unicode-trim contracts in this
 * tip.
 *
 * Inventory item identities are UUID-shaped on the hosted path but may be
 * other durable tokens in fixtures. Only ASCII end trim is pinned; case is
 * left unchanged so unknown casing still fails closed downstream. Max length
 * stays 80 to match the prior `boundedString(..., 80)` cap. Empty-after-trim
 * remains soft-empty string (`""`) so missing inventory-item evidence stays a
 * soft empty field without throwing.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority inventory-item identity
 * before it is stored as durable purchase-authority evidence.
 */
export function asciiTrimPurchaseAuthorityInventoryItemToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority inventoryItemId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityInventoryItemId(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityInventoryItemToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed inventoryItemId normalize for `normalizePurchaseAuthorityResult`.
 * Preserves soft empty / non-string → `""` (`boundedString` contract) while
 * refusing Unicode-padded tokens that would invent a durable inventory-item
 * identity. Error contract: `Purchase authority inventoryItemId is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityInventoryItemId(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }
  const canonical = canonicalizePurchaseAuthorityInventoryItemId(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → "".
  if (!value.trim()) return "";
  throw new Error("Purchase authority inventoryItemId is invalid.");
}
