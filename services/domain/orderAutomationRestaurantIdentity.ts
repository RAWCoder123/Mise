/**
 * Order-automation domain restaurant workspace identity helpers (MISE-005MW).
 *
 * Pins domain-layer `assessOrderAutomation` restaurantId outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase or
 * demo storage. Complements open order-automation supplier tip #773
 * (`Order automation requires a supplier id.` /
 * `canonicalizeOrderAutomationSupplierId`) without sharing that helper module
 * or rewriting supplier / supplier-name paths. Leaves sibling domain restaurant
 * workspace trims on `supplierReliability` and `insightsSalesAnalytics` for
 * later tips.
 *
 * Restaurant workspace IDs on this path may be UUID-shaped (hosted tenants) or
 * opaque demo tokens. Only ASCII end trim is pinned; case is left unchanged to
 * preserve the existing exact-match contract against candidate and inventory
 * `restaurant_id` values.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * inventory, candidates, and recommendation history are tenant-scoped.
 */
export function asciiTrimOrderAutomationRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an order-automation restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOrderAutomationRestaurantId(value: string): string | null {
  const trimmed = asciiTrimOrderAutomationRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `assessOrderAutomation`.
 * Preserves a distinct message from order-automation supplier tip #773:
 * `Order automation requires a restaurant.`
 */
export function requireCanonicalOrderAutomationWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Order automation requires a restaurant.");
  }
  const text = canonicalizeOrderAutomationRestaurantId(value);
  if (!text) {
    throw new Error("Order automation requires a restaurant.");
  }
  return text;
}
