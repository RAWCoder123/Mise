/**
 * Operational finding-decision response client-event identity helpers (MISE-005NO).
 *
 * Pins domain-layer `normalizeOperationalFindingDecision` response
 * `client_event_id` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Response
 * normalization previously Unicode-trimmed `client_event_id` ("Finding decision
 * event identity"), so NBSP/em-space padding invented a valid client-event
 * identity used as durable feedback correlation.
 *
 * Intentionally does not change response decision `id` (#796 / MISE-005NN),
 * response `finding_id` (#795 / MISE-005NM), response enums (#794 / MISE-005NL),
 * evidence type (#793 / MISE-005NK), evidence id (#792 / MISE-005NJ), restaurant
 * workspace (#791 / MISE-005NI), input object identities (#790 / MISE-005NH),
 * response `idempotency_key` / `actor_user_id`, or finding-decision outbox tips
 * (#785 / #786).
 *
 * Client-event tokens are not UUID-shaped on every path (device tokens such as
 * `device-event-1`). Only ASCII end trim is pinned; case is left unchanged so
 * unknown casing still fails closed downstream. Max length stays 200 to match
 * the prior `requireBoundedText(..., 200)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision client-event identity
 * before it is stored as durable feedback correlation.
 */
export function asciiTrimOperationalFindingDecisionResponseClientEventToken(
  value: string
) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision response client-event identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionResponseClientEventId(
  value: string
): string | null {
  const trimmed =
    asciiTrimOperationalFindingDecisionResponseClientEventToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed client-event identity require for finding-decision response
 * normalize. Preserves the stable `Finding decision event identity is invalid.`
 * contract and the existing 200-character bound.
 */
export function requireCanonicalOperationalFindingDecisionResponseClientEventId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision event identity is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionResponseClientEventId(value);
  if (!text) {
    throw new Error("Finding decision event identity is invalid.");
  }
  return text;
}
