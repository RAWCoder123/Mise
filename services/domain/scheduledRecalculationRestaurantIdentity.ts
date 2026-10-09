/**
 * Scheduled-recalculation restaurant workspace identity helpers (MISE-005LE).
 *
 * Pins application-layer `runScheduledRecalculations` restaurant_id outside the
 * recalculation cycle / port graph so Node tests can exercise inventing proofs
 * without loading ledger siblings. Complements open recalculation-run transport
 * (#734), recalculation-schedule (#733), restaurant-memory (#731), floor-note
 * (#730), activity-event (#729), and purchase-line (#728) restaurant tips
 * without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract. The dispatch entry point remains
 * fail-soft (`null`) rather than throwing, matching the existing never-throw
 * operator-session contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimScheduledRecalculationRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a scheduled-recalculation restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizeScheduledRecalculationRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimScheduledRecalculationRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require for scheduled-recalculation callers
 * that need a hard error. Preserves a stable
 * `Missing restaurant workspace.` contract. The Home/Today dispatch path uses
 * `canonicalizeScheduledRecalculationRestaurantId` and returns null instead.
 */
export function requireCanonicalScheduledRecalculationRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeScheduledRecalculationRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
