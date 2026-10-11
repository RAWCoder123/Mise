/**
 * Operational finding-decision restaurant workspace identity helpers
 * (MISE-005NI).
 *
 * Pins domain-layer `normalizeOperationalFindingDecisionInput`
 * `restaurantId` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage.
 *
 * Intentionally does not change `requireBoundedText` for client event /
 * idempotency object identities (#790 / MISE-005NH), free-text recommended
 * actions, evidence identities, or `finding.id.trim()`. Intentionally does
 * not rewrite application finding-decisions restaurant workspace (#749 /
 * MISE-005LS) or finding-decision outbox tips (#785 / #786).
 *
 * Restaurant workspace IDs on this path may be UUID-shaped (hosted tenants)
 * or opaque demo tokens. Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match contract against
 * `finding.restaurantId`. Max length stays 64 to match the prior
 * `requireBoundedText(..., 64)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * finding-decision scope validation and RPC argument construction.
 */
export function asciiTrimOperationalFindingDecisionRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require for finding-decision normalize.
 * Preserves the stable `Restaurant workspace is invalid.` contract and the
 * existing 64-character bound.
 */
export function requireCanonicalOperationalFindingDecisionRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant workspace is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionRestaurantId(value);
  if (!text) {
    throw new Error("Restaurant workspace is invalid.");
  }
  return text;
}
