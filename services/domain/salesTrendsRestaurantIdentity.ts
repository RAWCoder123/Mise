/**
 * Sales-trends domain restaurant workspace identity helpers (MISE-005MS).
 *
 * Pins domain-layer `buildRecordedSalesTrend` restaurantId outside the Insights
 * application graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open Insights application restaurant tip
 * #740 (`Missing restaurant workspace.` / `requireCanonicalInsightsWorkspaceId`)
 * without sharing that helper module or rewriting application Insights entry
 * points. Leaves sibling domain restaurant workspace trims on
 * `supplierSpend`, `wasteAnalysis`, and `inventoryCountAuthority` for later tips.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * sales rows are tenant-scoped.
 */
export function asciiTrimSalesTrendsRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a sales-trends restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSalesTrendsRestaurantId(value: string): string | null {
  const trimmed = asciiTrimSalesTrendsRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `buildRecordedSalesTrend`.
 * Preserves a distinct message from Insights application tip #740:
 * `Sales trend requires a restaurant.`
 */
export function requireCanonicalSalesTrendsWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Sales trend requires a restaurant.");
  }
  const text = canonicalizeSalesTrendsRestaurantId(value);
  if (!text) {
    throw new Error("Sales trend requires a restaurant.");
  }
  return text;
}
