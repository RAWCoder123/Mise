/**
 * Operational finding-decision evidence identity helpers (MISE-005NJ).
 *
 * Pins domain-layer `normalizeEvidence` evidence `id` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Shared by `normalizeOperationalFindingDecisionInput` and
 * `normalizeOperationalFindingDecision` response normalization.
 *
 * Intentionally does not change `requireBoundedText` for evidence `type` /
 * summary, restaurant workspace, free-text recommended actions,
 * `finding.id.trim()`, client event / idempotency object identities (#790 /
 * MISE-005NH), or restaurant workspace (#791 / MISE-005NI). Intentionally
 * does not rewrite finding-decision outbox tips (#785 / #786).
 *
 * Evidence ids are opaque reference tokens (inventory item ids, insight ids,
 * etc.), not UUID-only. Only ASCII end trim is pinned; case is left unchanged
 * to preserve the existing exact-match evidence contract. Max length stays
 * 240 to match the prior `requireBoundedText(..., 240)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding evidence identity before
 * decision RPC argument construction and response normalization.
 */
export function asciiTrimOperationalFindingDecisionEvidenceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision evidence identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionEvidenceId(
  value: string
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionEvidenceToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 240) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed evidence identity require for finding-decision normalizeEvidence.
 * Preserves the stable `Finding evidence identity is invalid.` contract and
 * the existing 240-character bound.
 */
export function requireCanonicalOperationalFindingDecisionEvidenceId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding evidence identity is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionEvidenceId(value);
  if (!text) {
    throw new Error("Finding evidence identity is invalid.");
  }
  return text;
}
