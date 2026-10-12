/**
 * Purchase-authority blocker metadata map-key identity helpers (MISE-005OJ).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `sanitizeMetadata` object
 * keys outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Purchase-authority blocker metadata
 * previously Unicode-trimmed map keys through shared `boundedString`, so
 * NBSP/em-space padding invented a valid durable metadata key before it was
 * stored as purchase-authority blocker evidence.
 *
 * Complements open purchase-authority recipe-revision tip #807 / MISE-005NY,
 * countEventId tip #806 / MISE-005NX, inventoryItemId tip #805 / MISE-005NW,
 * recommendationId tip #804 / MISE-005NV, and supplierId tip #803 / MISE-005NU
 * without sharing their helper modules or rewriting those paths. Intentionally
 * does not change other `boundedString` / `nullableString` surfaces
 * (`recommendationId`, `inventoryItemId`, `supplierId`, `countEventId`,
 * `countedAt`, `canonicalUnit`, recipe-revision keys, blocker descriptions,
 * metadata string values, or evaluatedAt). Those remain on their existing
 * Unicode-trim contracts in this tip.
 *
 * Metadata keys are durable blocker context identity tokens (for example
 * inventory or supplier-scoped audit fields). Only ASCII end trim is pinned;
 * case is left unchanged so unknown casing still fails closed downstream. Max
 * length stays 60 to match the prior `boundedString(..., 60)` cap.
 * Empty-after-trim remains a soft skip (`null`) so blank map entries stay
 * omitted without throwing. Over-long keys fail closed rather than silently
 * truncating to 60 characters.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority metadata key
 * before it is stored as durable purchase-authority blocker evidence.
 */
export function asciiTrimPurchaseAuthorityMetadataKeyToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority metadata map key under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityMetadataKey(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityMetadataKeyToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 60) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed metadata key normalize for `sanitizeMetadata`.
 * Preserves soft empty / non-string → `null` (omit map entry) while refusing
 * Unicode-padded tokens that would invent a durable metadata key.
 * Error contract: `Purchase authority metadata key is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityMetadataKey(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const canonical = canonicalizePurchaseAuthorityMetadataKey(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → omit entry.
  if (!value.trim()) return null;
  throw new Error("Purchase authority metadata key is invalid.");
}
