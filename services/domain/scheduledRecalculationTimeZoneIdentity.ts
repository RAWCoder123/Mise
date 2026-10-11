/**
 * Scheduled-recalculation restaurant timezone identity helpers (MISE-005NG).
 *
 * Pins application-layer `runScheduledRecalculations` `restaurantTimeZone`
 * outside the recalculation cycle / port graph so Node tests can exercise
 * inventing proofs without loading ledger siblings. Complements open
 * scheduled-recalculation restaurant workspace tip #735 (restaurant_id only)
 * and domain recalculation-schedule timezone tip #788 without sharing those
 * helper modules or error contracts.
 *
 * IANA timezone tokens are not UUID-shaped (`America/New_York`). Only ASCII
 * end trim is pinned; case is left unchanged to preserve the existing Intl
 * timezone contract. The Home/Today dispatch entry point remains fail-soft
 * (`null`) rather than throwing, matching the existing never-throw
 * operator-session contract. Max length 128 matches sibling identity tips.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant timezone identity before
 * Home/Today scheduled recalculation dispatch.
 */
export function asciiTrimScheduledRecalculationTimeZoneToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a scheduled-recalculation restaurant timezone under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeScheduledRecalculationTimeZone(
  value: string
): string | null {
  const trimmed = asciiTrimScheduledRecalculationTimeZoneToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant timezone require for scheduled-recalculation callers
 * that need a hard error. Preserves a stable
 * `Missing restaurant timezone.` contract. The Home/Today dispatch path uses
 * `canonicalizeScheduledRecalculationTimeZone` and returns null instead.
 */
export function requireCanonicalScheduledRecalculationTimeZone(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant timezone.");
  }
  const text = canonicalizeScheduledRecalculationTimeZone(value);
  if (!text) {
    throw new Error("Missing restaurant timezone.");
  }
  return text;
}
