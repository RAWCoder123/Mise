/**
 * Inventory count-authority restaurant workspace identity helpers (MISE-005MV).
 *
 * Pins domain-layer `buildInventoryCountEvidence` restaurantId outside application
 * graphs so Node tests can exercise inventing proofs without loading Supabase or
 * demo storage. Complements open waste-analysis domain tip #777
 * (`Waste analysis requires a restaurant.` / `requireCanonicalWasteAnalysisWorkspaceId`)
 * and supplier-spend domain tip #776 without sharing those helper modules.
 * Leaves sibling domain restaurant workspace trims on those modules alone.
 *
 * Restaurant workspace IDs on this path may be UUID-shaped (hosted tenants) or
 * opaque demo tokens. Only ASCII end trim is pinned; case is left unchanged to
 * preserve the existing exact-match contract against ledger `restaurantId`.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * ledger events are tenant-scoped for count evidence.
 */
export function asciiTrimInventoryCountAuthorityRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory count-authority restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizeInventoryCountAuthorityRestaurantId(value: string): string | null {
  const trimmed = asciiTrimInventoryCountAuthorityRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `buildInventoryCountEvidence`.
 * Preserves a distinct message from waste-analysis tip #777 and supplier-spend tip #776:
 * `Inventory count evidence requires a restaurant.`
 */
export function requireCanonicalInventoryCountAuthorityWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Inventory count evidence requires a restaurant.");
  }
  const text = canonicalizeInventoryCountAuthorityRestaurantId(value);
  if (!text) {
    throw new Error("Inventory count evidence requires a restaurant.");
  }
  return text;
}
