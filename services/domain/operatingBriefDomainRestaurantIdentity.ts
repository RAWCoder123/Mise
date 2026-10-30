/**
 * Operating-brief domain restaurant workspace identity helpers (MISE-005UN).
 *
 * Pins domain-layer `buildOperatingBrief` `input.restaurant.id` outside the
 * application fetch graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Prior `buildOperatingBrief` Unicode-trimmed
 * the restaurant workspace id before tenant-scoping sales, inventory, orders,
 * recommendations, and insights
 * (`'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'`), so NBSP/em-space
 * padding invented a clean workspace identity used for cross-record scope
 * checks.
 *
 * Open application tip #746 / MISE-005LP owns `fetchOperatingBrief` workspace
 * prep via `operatingBriefRestaurantIdentity.ts` and the
 * `Missing restaurant workspace.` contract. This module owns only the domain
 * `buildOperatingBrief` path and preserves
 * `Operating brief requires a restaurant id.` Soft empty / Unicode-padded /
 * control-bearing / over-long tokens fail closed under that same domain
 * contract. Ordinary ASCII whitespace still trims clean. Case is left
 * unchanged (demo tenants use tokens like `restaurant_a`).
 *
 * Do not share with #746 application operating-brief restaurant identity,
 * #747 daily-phase-brief restaurant identity, or other restaurant workspace
 * tips.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized operating-brief domain restaurant workspace
 * identity before tenant-scope checks.
 */
export function asciiTrimOperatingBriefDomainRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an operating-brief domain restaurant workspace identity under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * over-long, or containing ASCII controls.
 */
export function canonicalizeOperatingBriefDomainRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimOperatingBriefDomainRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by domain `buildOperatingBrief`.
 * Preserves the existing `Operating brief requires a restaurant id.` error
 * contract.
 */
export function requireCanonicalOperatingBriefDomainRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Operating brief requires a restaurant id.");
  }
  const text = canonicalizeOperatingBriefDomainRestaurantId(value);
  if (!text) {
    throw new Error("Operating brief requires a restaurant id.");
  }
  return text;
}
