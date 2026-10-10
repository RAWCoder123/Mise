/**
 * Supplier-spend domain restaurant workspace identity helpers (MISE-005MT).
 *
 * Pins domain-layer `buildSupplierSpendTrend` restaurantId outside the Orders
 * application graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open sales-trends domain tip #775
 * (`Sales trend requires a restaurant.` / `requireCanonicalSalesTrendsWorkspaceId`)
 * and waste application tip #751 without sharing those helper modules.
 * Leaves sibling domain restaurant workspace trims on `wasteAnalysis` and
 * `inventoryCountAuthority` for later tips.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a` / `rest_1`). Only ASCII end trim is pinned; case
 * is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * orders and recommendations are tenant-scoped.
 */
export function asciiTrimSupplierSpendRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a supplier-spend restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSupplierSpendRestaurantId(value: string): string | null {
  const trimmed = asciiTrimSupplierSpendRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `buildSupplierSpendTrend`.
 * Preserves a distinct message from sales-trends tip #775 and waste tip #751:
 * `Supplier spend requires a restaurant.`
 */
export function requireCanonicalSupplierSpendWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier spend requires a restaurant.");
  }
  const text = canonicalizeSupplierSpendRestaurantId(value);
  if (!text) {
    throw new Error("Supplier spend requires a restaurant.");
  }
  return text;
}
