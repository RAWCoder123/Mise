/**
 * Purchase-authority recipe-revision map-key identity helpers (MISE-005NY).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `evidence.recipeRevisions`
 * object keys outside the repository graph so Node tests can exercise inventing
 * proofs without loading Supabase or demo storage. Purchase-authority evidence
 * previously Unicode-trimmed recipe-revision keys through shared `boundedString`,
 * so NBSP/em-space padding invented a valid durable recipe / menu revision key
 * before it was stored as purchase-authority evidence.
 *
 * Complements open purchase-authority countEventId tip #806 / MISE-005NX,
 * inventoryItemId tip #805 / MISE-005NW, recommendationId tip #804 / MISE-005NV,
 * and supplierId tip #803 / MISE-005NU without sharing their helper modules or
 * rewriting those paths. Intentionally does not change other `boundedString` /
 * `nullableString` surfaces (`recommendationId`, `inventoryItemId`, `supplierId`,
 * `countEventId`, `countedAt`, `canonicalUnit`, blocker descriptions, metadata
 * keys/values, or evaluatedAt). Those remain on their existing Unicode-trim
 * contracts in this tip.
 *
 * Recipe-revision keys are durable menu / recipe identity tokens. Only ASCII end
 * trim is pinned; case is left unchanged so unknown casing still fails closed
 * downstream. Max length stays 80 to match the prior `boundedString(..., 80)`
 * cap. Empty-after-trim remains a soft skip (`null`) so blank map entries stay
 * omitted without throwing. Over-long keys fail closed rather than silently
 * truncating to 80 characters.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority recipe-revision key
 * before it is stored as durable purchase-authority evidence.
 */
export function asciiTrimPurchaseAuthorityRecipeRevisionToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority recipe-revision map key under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityRecipeRevisionKey(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityRecipeRevisionToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed recipe-revision key normalize for `normalizePurchaseAuthorityResult`.
 * Preserves soft empty / non-string → `null` (omit map entry) while refusing
 * Unicode-padded tokens that would invent a durable recipe-revision key.
 * Error contract: `Purchase authority recipe revision key is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const canonical = canonicalizePurchaseAuthorityRecipeRevisionKey(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → omit entry.
  if (!value.trim()) return null;
  throw new Error("Purchase authority recipe revision key is invalid.");
}
