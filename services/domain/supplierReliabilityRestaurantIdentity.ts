/**
 * Supplier-reliability domain restaurant workspace identity helpers (MISE-005MX).
 *
 * Pins domain-layer `buildSupplierReliabilitySummary` and
 * `buildSupplierOrderDeliveryEvidence` restaurantId outside the Orders
 * application graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open order-automation restaurant tip
 * #779 and leaves sibling domain restaurant workspace trim on
 * `insightsSalesAnalytics` for a later tip. Does not rewrite supplier_id /
 * supplier_name presentation trims inside supplierReliability.
 *
 * Restaurant workspace IDs on this path may be UUID-shaped (hosted tenants) or
 * opaque demo tokens. Only ASCII end trim is pinned; case is left unchanged to
 * preserve the existing exact-match contract against order, delivery, and item
 * `restaurant_id` values.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * orders, deliveries, and delivery items are tenant-scoped.
 */
export function asciiTrimSupplierReliabilityRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a supplier-reliability restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSupplierReliabilityRestaurantId(value: string): string | null {
  const trimmed = asciiTrimSupplierReliabilityRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain
 * `buildSupplierReliabilitySummary`.
 * Preserves message `Supplier reliability requires a restaurant workspace.`
 */
export function requireCanonicalSupplierReliabilityWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier reliability requires a restaurant workspace.");
  }
  const text = canonicalizeSupplierReliabilityRestaurantId(value);
  if (!text) {
    throw new Error("Supplier reliability requires a restaurant workspace.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by domain
 * `buildSupplierOrderDeliveryEvidence`.
 * Preserves a distinct message from the summary path:
 * `Supplier delivery evidence requires a restaurant workspace.`
 */
export function requireCanonicalSupplierDeliveryEvidenceWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier delivery evidence requires a restaurant workspace.");
  }
  const text = canonicalizeSupplierReliabilityRestaurantId(value);
  if (!text) {
    throw new Error("Supplier delivery evidence requires a restaurant workspace.");
  }
  return text;
}
