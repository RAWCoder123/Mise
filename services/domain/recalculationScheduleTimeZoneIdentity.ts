/**
 * Recalculation-schedule restaurant timezone identity helpers (MISE-005NF).
 *
 * Pins domain-layer `buildRecalculationSchedule` `restaurantTimeZone` outside
 * the full schedule graph so Node tests can exercise inventing proofs without
 * loading transport or application siblings. Complements open
 * recalculation-schedule restaurant workspace tip #733 without sharing that
 * helper module. Leaves the application-layer scheduled recalculation timezone
 * Unicode trim (#735 owns restaurant workspace only) and wasteAnalysis /
 * supplierReliability timezone emptiness checks alone — those Intl-validate
 * the raw padded value and fail closed rather than inventing a service day.
 *
 * IANA timezone tokens are not UUID-shaped (`America/New_York`). Only ASCII
 * end trim is pinned; case is left unchanged to preserve the existing
 * Intl timezone contract. Max length 128 matches sibling identity tips.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant timezone identity before
 * service-day and cycle-window evaluation.
 */
export function asciiTrimRecalculationScheduleTimeZoneToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recalculation-schedule restaurant timezone under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRecalculationScheduleTimeZone(
  value: string
): string | null {
  const trimmed = asciiTrimRecalculationScheduleTimeZoneToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant timezone require used by recalculation-schedule
 * domain entry points. Preserves the existing
 * `Recalculation scheduling requires a restaurant timezone.` error contract.
 */
export function requireCanonicalRecalculationScheduleTimeZone(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Recalculation scheduling requires a restaurant timezone.");
  }
  const text = canonicalizeRecalculationScheduleTimeZone(value);
  if (!text) {
    throw new Error("Recalculation scheduling requires a restaurant timezone.");
  }
  return text;
}
