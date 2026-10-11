/**
 * Operational finding-decision response idempotency-key helpers (MISE-005NP).
 *
 * Pins domain-layer `normalizeOperationalFindingDecision` response
 * `idempotency_key` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Response
 * normalization previously Unicode-trimmed `idempotency_key` ("Finding decision
 * idempotency key"), so NBSP/em-space padding invented a valid idempotency
 * identity used as durable feedback dedupe authority.
 *
 * Intentionally does not change response decision `id` (#796 / MISE-005NN),
 * response `finding_id` (#795 / MISE-005NM), response enums (#794 / MISE-005NL),
 * evidence type (#793 / MISE-005NK), evidence id (#792 / MISE-005NJ), restaurant
 * workspace (#791 / MISE-005NI), input object identities (#790 / MISE-005NH),
 * response `client_event_id` (#797 / MISE-005NO), response `actor_user_id`,
 * input `idempotencyKey`, or finding-decision outbox tips (#785 / #786).
 *
 * Idempotency tokens are not UUID-shaped on every path (keys such as
 * `finding-decision:device-event-1`). Only ASCII end trim is pinned; case is
 * left unchanged so unknown casing still fails closed downstream. Max length
 * stays 240 to match the prior `requireBoundedText(..., 240)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision idempotency identity
 * before it is stored as durable feedback dedupe authority.
 */
export function asciiTrimOperationalFindingDecisionResponseIdempotencyToken(
  value: string
) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision response idempotency key under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionResponseIdempotencyKey(
  value: string
): string | null {
  const trimmed =
    asciiTrimOperationalFindingDecisionResponseIdempotencyToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 240) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed idempotency-key require for finding-decision response normalize.
 * Preserves the stable `Finding decision idempotency key is invalid.` contract
 * and the existing 240-character bound.
 */
export function requireCanonicalOperationalFindingDecisionResponseIdempotencyKey(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision idempotency key is invalid.");
  }
  const text =
    canonicalizeOperationalFindingDecisionResponseIdempotencyKey(value);
  if (!text) {
    throw new Error("Finding decision idempotency key is invalid.");
  }
  return text;
}
