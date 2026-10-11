/**
 * Operational finding-decision response decision identity helpers (MISE-005NN).
 *
 * Pins domain-layer `normalizeOperationalFindingDecision` response
 * decision `id` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Response
 * normalization previously Unicode-trimmed `id` ("Finding decision identity"),
 * so NBSP/em-space padding invented a valid decision identity.
 *
 * Intentionally does not change response `finding_id` (#795 / MISE-005NM),
 * response enums (#794 / MISE-005NL), evidence type (#793 / MISE-005NK),
 * evidence id (#792 / MISE-005NJ), restaurant workspace (#791 / MISE-005NI),
 * object identities (#790 / MISE-005NH), response `actor_user_id` / client
 * event / idempotency, or finding-decision outbox tips (#785 / #786).
 *
 * Decision identities are UUID-shaped on the hosted path but may be other
 * durable tokens in fixtures. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Max length stays
 * 64 to match the prior `requireBoundedText(..., 64)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision identity before it is
 * stored as manager feedback authority.
 */
export function asciiTrimOperationalFindingDecisionResponseIdToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision response decision identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionResponseId(
  value: string
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionResponseIdToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed decision identity require for finding-decision response normalize.
 * Preserves the stable `Finding decision identity is invalid.` contract and the
 * existing 64-character bound.
 */
export function requireCanonicalOperationalFindingDecisionResponseId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision identity is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionResponseId(value);
  if (!text) {
    throw new Error("Finding decision identity is invalid.");
  }
  return text;
}
