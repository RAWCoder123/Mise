/**
 * Restaurant-memory restaurant workspace identity helpers (MISE-005LB).
 *
 * Pins domain-layer restaurant-memory restaurant_id outside the full memory
 * graph so Node tests can exercise inventing proofs without loading autonomy
 * or repository siblings. Complements open floor-note (#730), activity-event
 * (#729), purchase-line (#728), and supplier-recipient (#727) restaurant tips
 * without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimRestaurantMemoryRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-memory restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantMemoryRestaurantId(value: string): string | null {
  const trimmed = asciiTrimRestaurantMemoryRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by restaurant-memory domain
 * entry points. Preserves the existing
 * `Restaurant memory requires a restaurant id.` error contract.
 */
export function requireCanonicalRestaurantMemoryRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant memory requires a restaurant id.");
  }
  const text = canonicalizeRestaurantMemoryRestaurantId(value);
  if (!text) {
    throw new Error("Restaurant memory requires a restaurant id.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by restaurant-memory
 * application entry points. Preserves the existing
 * `Missing restaurant workspace.` error contract.
 */
export function requireCanonicalRestaurantMemoryWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeRestaurantMemoryRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
