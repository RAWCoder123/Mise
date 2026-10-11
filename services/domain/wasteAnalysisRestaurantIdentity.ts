/**
 * Waste-analysis domain restaurant workspace identity helpers (MISE-005MU).
 *
 * Pins domain-layer `buildWasteAnalysis` restaurantId outside the waste
 * application graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open waste application tip #751
 * (`Missing restaurant workspace.` / `requireCanonicalWasteWorkspaceId`) and
 * supplier-spend domain tip #776 without sharing those helper modules.
 * Leaves sibling domain restaurant workspace trim on `inventoryCountAuthority`
 * for a later tip.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant-a` / `restaurant_a`). Only ASCII end trim is pinned;
 * case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * inventory items and waste events are tenant-scoped.
 */
export function asciiTrimWasteAnalysisRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a waste-analysis restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeWasteAnalysisRestaurantId(value: string): string | null {
  const trimmed = asciiTrimWasteAnalysisRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `buildWasteAnalysis`.
 * Preserves a distinct message from waste application tip #751:
 * `Waste analysis requires a restaurant.`
 */
export function requireCanonicalWasteAnalysisWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Waste analysis requires a restaurant.");
  }
  const text = canonicalizeWasteAnalysisRestaurantId(value);
  if (!text) {
    throw new Error("Waste analysis requires a restaurant.");
  }
  return text;
}
