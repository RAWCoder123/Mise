/**
 * Orders workflow restaurant identity helpers (MISE-005LZ).
 *
 * Pins application-layer orders.ts `requireWorkflowId(..., "restaurant")`
 * restaurant_id for the `Missing restaurant.` Gmail/send workflow paths
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Complements open orders
 * authorities tip #754, which owns `Missing restaurant workspace.` and leaves
 * this workflow helper alone.
 *
 * Intentionally does not rewrite `fetchPurchaseRecommendationAuthorities`
 * Unicode trim (`Missing restaurant workspace.`) — that path remains #754.
 * Intentionally does not change non-restaurant `requireWorkflowId` labels
 * (supplier order, purchase decision event, supplier, …).
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimOrdersWorkflowRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an orders workflow restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOrdersWorkflowRestaurantId(value: string): string | null {
  const trimmed = asciiTrimOrdersWorkflowRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by orders
 * `requireWorkflowId(..., "restaurant")`. Preserves the existing
 * `Missing restaurant.` error contract asserted by `tests/gmailClient.test.ts`.
 */
export function requireCanonicalOrdersWorkflowRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant.");
  }
  const text = canonicalizeOrdersWorkflowRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant.");
  }
  return text;
}
