/**
 * Purchase-authority blocker metadata string-value identity helpers (MISE-005OK).
 *
 * Pins domain-layer `normalizePurchaseAuthorityResult` `sanitizeMetadata` string
 * values outside the repository graph so Node tests can exercise inventing
 * proofs without loading Supabase or demo storage. Purchase-authority blocker
 * metadata previously Unicode-trimmed string values through shared
 * `boundedString`, so NBSP/em-space padding invented a valid durable metadata
 * string value (for example `menuItemId` or `supplierOrderId`) before it was
 * stored as purchase-authority blocker evidence.
 *
 * Complements open purchase-authority metadata-key tip #818 / MISE-005OJ,
 * recipe-revision tip #807 / MISE-005NY, countEventId tip #806 / MISE-005NX,
 * inventoryItemId tip #805 / MISE-005NW, recommendationId tip #804 / MISE-005NV,
 * and supplierId tip #803 / MISE-005NU without sharing their helper modules or
 * rewriting those paths. Intentionally does not change other `boundedString` /
 * `nullableString` surfaces (`recommendationId`, `inventoryItemId`,
 * `supplierId`, `countEventId`, `countedAt`, `canonicalUnit`, recipe-revision
 * keys, blocker descriptions, metadata map keys, or evaluatedAt). Those remain
 * on their existing Unicode-trim contracts in this tip.
 *
 * Metadata string values are durable blocker context identity tokens (for
 * example menu-item IDs, supplier-order IDs, and count timestamps). Only ASCII
 * end trim is pinned; case is left unchanged so unknown casing still fails
 * closed downstream. Max length stays 120 to match the prior
 * `boundedString(..., 120)` cap. Empty-after-trim remains a soft empty string
 * (`""`) so blank string values keep the prior `boundedString` contract without
 * throwing. Over-long values fail closed rather than silently truncating to
 * 120 characters.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-authority metadata string value
 * before it is stored as durable purchase-authority blocker evidence.
 */
export function asciiTrimPurchaseAuthorityMetadataValueToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-authority metadata string value under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseAuthorityMetadataValue(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseAuthorityMetadataValueToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 120) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed metadata string-value normalize for `sanitizeMetadata`.
 * Preserves soft empty / non-string → `""` (`boundedString` contract) while
 * refusing Unicode-padded tokens that would invent a durable metadata string
 * value. Error contract: `Purchase authority metadata value is invalid.`
 */
export function normalizeCanonicalPurchaseAuthorityMetadataValue(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }
  const canonical = canonicalizePurchaseAuthorityMetadataValue(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → "".
  if (!value.trim()) return "";
  throw new Error("Purchase authority metadata value is invalid.");
}
