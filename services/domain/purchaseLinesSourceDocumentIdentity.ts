/**
 * Purchase-lines application source-document identity helpers (MISE-005ML).
 *
 * Pins application-layer purchaseLines.ts `sourceDocumentReference` outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Complements open purchase-line restaurant
 * tip #728 (`Missing restaurant workspace.`) and open lineId tip #764
 * (`Missing purchase line.` / `requireCanonicalPurchaseLinesLineId`) without
 * sharing their helper modules or rewriting those paths.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `ingestPurchaseLines` / `correctPurchaseLine` / history / net entry points.
 * Those remain on Unicode trim here and are owned by #728 / MISE-005KY.
 * Intentionally does not rewrite `lineId.trim()` on `correctPurchaseLine`
 * (owned by #764 / MISE-005MH) or `normalizePurchaseLineInput` field trim
 * surfaces.
 *
 * Source document references are operator-facing invoice / memo keys such as
 * `INV-4471`, not UUID-shaped. Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract. Max length follows the hosted
 * `purchase_lines.source_document_reference` bound of 200.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized source-document identity.
 */
export function asciiTrimPurchaseLinesSourceDocumentToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-lines source-document identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseLinesSourceDocumentReference(
  value: string
): string | null {
  const trimmed = asciiTrimPurchaseLinesSourceDocumentToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed source-document require used by purchase-lines
 * `ingestPurchaseLines`. Preserves the existing
 * `A source document reference is required.` error contract.
 */
export function requireCanonicalPurchaseLinesSourceDocumentReference(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("A source document reference is required.");
  }
  const text = canonicalizePurchaseLinesSourceDocumentReference(value);
  if (!text) {
    throw new Error("A source document reference is required.");
  }
  return text;
}
