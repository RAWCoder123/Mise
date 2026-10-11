/**
 * Operational finding-decision response actor helpers (MISE-005NQ).
 *
 * Pins domain-layer `normalizeOperationalFindingDecision` response
 * `actor_user_id` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Response
 * normalization previously Unicode-trimmed `actor_user_id` ("Finding decision
 * actor"), so NBSP/em-space padding invented a valid actor identity used as
 * durable feedback attribution authority.
 *
 * Intentionally does not change response decision `id` (#796 / MISE-005NN),
 * response `finding_id` (#795 / MISE-005NM), response enums (#794 / MISE-005NL),
 * evidence type (#793 / MISE-005NK), evidence id (#792 / MISE-005NJ), restaurant
 * workspace (#791 / MISE-005NI), input object identities (#790 / MISE-005NH),
 * response `client_event_id` (#797 / MISE-005NO), response `idempotency_key`
 * (#798 / MISE-005NP), input `idempotencyKey`, or finding-decision outbox tips
 * (#785 / #786).
 *
 * Actor identities are UUID-shaped on the hosted path but may be other durable
 * tokens in fixtures. Only ASCII end trim is pinned; case is left unchanged so
 * unknown casing still fails closed downstream. Max length stays 64 to match
 * the prior `requireBoundedText(..., 64)` bound. Null actor remains allowed.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision actor identity before it is
 * stored as durable feedback attribution authority.
 */
export function asciiTrimOperationalFindingDecisionResponseActorToken(
  value: string
) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision response actor identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionResponseActorUserId(
  value: string
): string | null {
  const trimmed =
    asciiTrimOperationalFindingDecisionResponseActorToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed actor require for finding-decision response normalize.
 * Preserves the stable `Finding decision actor is invalid.` contract and the
 * existing 64-character bound.
 */
export function requireCanonicalOperationalFindingDecisionResponseActorUserId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision actor is invalid.");
  }
  const text =
    canonicalizeOperationalFindingDecisionResponseActorUserId(value);
  if (!text) {
    throw new Error("Finding decision actor is invalid.");
  }
  return text;
}
