/**
 * Recalculation-schedule restaurant workspace identity helpers (MISE-005LC).
 *
 * Pins domain-layer recalculation-schedule restaurant_id outside the full
 * schedule graph so Node tests can exercise inventing proofs without loading
 * transport or application siblings. Complements open restaurant-memory
 * (#731), floor-note (#730), activity-event (#729), and purchase-line (#728)
 * restaurant tips without sharing their files. Leaves
 * `recalculationRunTransport` and `scheduledRecalculations` restaurant tips
 * for separate follow-ups.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimRecalculationScheduleRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recalculation-schedule restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizeRecalculationScheduleRestaurantId(value: string): string | null {
  const trimmed = asciiTrimRecalculationScheduleRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by recalculation-schedule
 * domain entry points. Preserves the existing
 * `Recalculation scheduling requires a restaurant.` error contract.
 */
export function requireCanonicalRecalculationScheduleRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Recalculation scheduling requires a restaurant.");
  }
  const text = canonicalizeRecalculationScheduleRestaurantId(value);
  if (!text) {
    throw new Error("Recalculation scheduling requires a restaurant.");
  }
  return text;
}
