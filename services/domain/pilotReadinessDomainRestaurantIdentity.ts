/**
 * Pilot-readiness domain restaurant workspace identity helpers (MISE-005UZ).
 *
 * Pins domain-layer `buildPilotReadiness` `input.restaurantId` outside the
 * application fetch graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Prior `buildPilotReadiness` Unicode-trimmed
 * the restaurant workspace id before tenant-scope checks and readiness scoring
 * (`'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'`), so NBSP/em-space
 * padding invented a clean workspace identity used for cross-record scope
 * checks.
 *
 * Open application tip #745 / MISE-005LO owns `fetchPilotReadiness` workspace
 * prep via `pilotReadinessRestaurantIdentity.ts` and the
 * `Missing restaurant workspace.` contract. This module owns only the domain
 * `buildPilotReadiness` path and preserves
 * `Pilot readiness requires a restaurant id.` Soft empty / Unicode-padded /
 * control-bearing / over-long tokens fail closed under that same domain
 * contract. Ordinary ASCII whitespace still trims clean. Case is left
 * unchanged (demo tenants use tokens like `restaurant_a`).
 *
 * Do not share with #745 application pilot-readiness restaurant identity,
 * #826 supplier_id tip, #875 sale item-name tip, or other restaurant workspace
 * tips.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized pilot-readiness domain restaurant workspace
 * identity before tenant-scope checks.
 */
export function asciiTrimPilotReadinessDomainRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a pilot-readiness domain restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizePilotReadinessDomainRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimPilotReadinessDomainRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `buildPilotReadiness`.
 * Preserves the existing `Pilot readiness requires a restaurant id.` error
 * contract.
 */
export function requireCanonicalPilotReadinessDomainRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Pilot readiness requires a restaurant id.");
  }
  const text = canonicalizePilotReadinessDomainRestaurantId(value);
  if (!text) {
    throw new Error("Pilot readiness requires a restaurant id.");
  }
  return text;
}
