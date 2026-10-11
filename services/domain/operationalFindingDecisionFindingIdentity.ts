/**
 * Operational finding-decision response finding identity helpers (MISE-005NM).
 *
 * Pins domain-layer `normalizeOperationalFindingDecision` response
 * `finding_id` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Response
 * normalization previously Unicode-trimmed `finding_id` before the finding-id
 * pattern check, so NBSP/em-space padding invented a valid finding identity.
 *
 * Intentionally does not change input-path `finding.id` handling (raw pattern
 * gate before `.trim()` — already fail-closed). Intentionally does not rewrite
 * response enums (#794 / MISE-005NL), evidence type (#793 / MISE-005NK),
 * evidence id (#792 / MISE-005NJ), restaurant workspace (#791 / MISE-005NI),
 * object identities (#790 / MISE-005NH), response decision `id` / actor /
 * client event / idempotency, or finding-decision outbox tips (#785 / #786).
 *
 * Only ASCII end trim is pinned before the existing finding-id pattern check;
 * case is left unchanged so unknown casing still fails closed. Max length
 * stays 240 to match the prior `requireBoundedText(..., 240)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding identity before the pattern check
 * in response normalization.
 */
export function asciiTrimOperationalFindingDecisionFindingToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision response finding identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionFindingId(
  value: string
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionFindingToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 240) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed finding identity require for finding-decision response normalize.
 * Preserves the stable `Finding identity is invalid.` contract and the
 * existing 240-character bound. Pattern membership remains the caller's
 * responsibility so this tip does not rewrite finding-id shape wording.
 */
export function requireCanonicalOperationalFindingDecisionFindingId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding identity is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionFindingId(value);
  if (!text) {
    throw new Error("Finding identity is invalid.");
  }
  return text;
}
