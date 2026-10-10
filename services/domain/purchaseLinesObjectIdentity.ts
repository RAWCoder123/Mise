/**
 * Purchase-lines application object identity helpers (MISE-005MH).
 *
 * Pins application-layer purchaseLines.ts `lineId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open purchase-line restaurant tip #728
 * (`Missing restaurant workspace.` / `requireCanonicalPurchaseLineRestaurantId`)
 * without sharing its helper module or rewriting the restaurant workspace path.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `correctPurchaseLine` / `ingestPurchaseLines` / history / net entry points.
 * Those remain on Unicode trim here and are owned by #728 / MISE-005KY.
 * Intentionally does not rewrite `sourceDocumentReference.trim()` or
 * `normalizePurchaseLineInput` field trim surfaces.
 *
 * Purchase line IDs are not UUID-shaped on every path (demo tokens such as
 * `purchase_line_<uuid>`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized purchase-line object identity.
 */
export function asciiTrimPurchaseLinesObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a purchase-lines object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePurchaseLinesObjectId(value: string): string | null {
  const trimmed = asciiTrimPurchaseLinesObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed line require used by purchase-lines `correctPurchaseLine`.
 * Preserves the existing `Missing purchase line.` error contract.
 */
export function requireCanonicalPurchaseLinesLineId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing purchase line.");
  }
  const text = canonicalizePurchaseLinesObjectId(value);
  if (!text) {
    throw new Error("Missing purchase line.");
  }
  return text;
}
