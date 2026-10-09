/**
 * Activity-event restaurant workspace identity helpers (MISE-005KZ).
 *
 * Pins domain-layer activity-event restaurant_id outside the full activity
 * graph so Node tests can exercise inventing proofs without loading
 * presentation or repository siblings. Complements open purchase-line (#728)
 * and supplier-recipient (#727) restaurant tips without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimActivityEventRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an activity-event restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeActivityEventRestaurantId(value: string): string | null {
  const trimmed = asciiTrimActivityEventRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by activity-event domain
 * entry points. Preserves the existing
 * `Activity events require a restaurant id.` error contract.
 */
export function requireCanonicalActivityEventRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Activity events require a restaurant id.");
  }
  const text = canonicalizeActivityEventRestaurantId(value);
  if (!text) {
    throw new Error("Activity events require a restaurant id.");
  }
  return text;
}
