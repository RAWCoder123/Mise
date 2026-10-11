/**
 * Operational finding-decision evidence type helpers (MISE-005NK).
 *
 * Pins domain-layer `normalizeEvidence` evidence `type` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Shared by `normalizeOperationalFindingDecisionInput` and
 * `normalizeOperationalFindingDecision` response normalization.
 *
 * Intentionally does not change `requireBoundedText` for evidence `id` /
 * summary, restaurant workspace, free-text recommended actions,
 * `finding.id.trim()`, client event / idempotency object identities (#790 /
 * MISE-005NH), restaurant workspace (#791 / MISE-005NI), or evidence identity
 * (#792 / MISE-005NJ). Intentionally does not rewrite finding-decision outbox
 * tips (#785 / #786).
 *
 * Evidence types are closed enum tokens (`inventory_item`, …). Only ASCII end
 * trim is pinned before the existing allowlist check; case is left unchanged
 * so unknown casing still fails closed. Max length stays 80 to match the prior
 * `requireBoundedText(..., 80)` bound.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding evidence type enum token before
 * the allowlist check in decision RPC argument construction and response
 * normalization.
 */
export function asciiTrimOperationalFindingDecisionEvidenceTypeToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision evidence type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionEvidenceType(
  value: string
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionEvidenceTypeToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed evidence type require for finding-decision normalizeEvidence.
 * Preserves the stable `Finding evidence type is invalid.` contract and the
 * existing 80-character bound. Allowlist membership remains the caller's
 * responsibility so this tip does not rewrite enum error wording.
 */
export function requireCanonicalOperationalFindingDecisionEvidenceType(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding evidence type is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionEvidenceType(value);
  if (!text) {
    throw new Error("Finding evidence type is invalid.");
  }
  return text;
}
