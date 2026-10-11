/**
 * Operational finding-decision object identity helpers (MISE-005NH).
 *
 * Pins domain-layer `normalizeOperationalFindingDecisionInput`
 * `clientEventId` / `idempotencyKey` outside the repository graph so Node
 * tests can exercise inventing proofs without loading Supabase or demo
 * storage.
 *
 * Intentionally does not change `requireBoundedText` for restaurant
 * workspace, free-text recommended actions, evidence identities, or
 * `finding.id.trim()` — those remain on Unicode trim in this tip.
 * Intentionally does not rewrite finding-decision outbox entry id (#785 /
 * MISE-005NC) or outbox keyPrefix (#786 / MISE-005ND).
 *
 * Decision event / idempotency tokens are not UUID-shaped on every path
 * (device tokens such as `device-event-1`). Only ASCII end trim is pinned;
 * case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision object identity before
 * RPC argument construction.
 */
export function asciiTrimOperationalFindingDecisionObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionObjectId(
  value: string,
  maxLength: number
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed client event identity require for finding-decision normalize.
 * Preserves the stable `Finding decision event identity is invalid.` contract
 * and the existing 200-character bound.
 */
export function requireCanonicalOperationalFindingDecisionClientEventId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision event identity is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionObjectId(value, 200);
  if (!text) {
    throw new Error("Finding decision event identity is invalid.");
  }
  return text;
}

/**
 * Fail-closed idempotency key require for finding-decision normalize.
 * Preserves the stable `Finding decision idempotency key is invalid.` contract
 * and the existing 240-character bound.
 */
export function requireCanonicalOperationalFindingDecisionIdempotencyKey(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision idempotency key is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionObjectId(value, 240);
  if (!text) {
    throw new Error("Finding decision idempotency key is invalid.");
  }
  return text;
}
