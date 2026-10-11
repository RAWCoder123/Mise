/**
 * Operational finding-decision response enum helpers (MISE-005NL).
 *
 * Pins domain-layer `normalizeOperationalFindingDecision` response
 * `decision_type` / `finding_category` / `severity` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Response normalization previously Unicode-trimmed these
 * closed enum tokens before the allowlist, so NBSP/em-space padding invented a
 * valid token.
 *
 * Intentionally does not change input-path enum membership checks (raw
 * `Set.has` without trim — already fail-closed). Intentionally does not
 * rewrite evidence `type` (#793 / MISE-005NK), evidence id/summary, restaurant
 * workspace (#791 / MISE-005NI), `finding.id.trim()`, object identities
 * (#790 / MISE-005NH), response identity fields (`finding_id`, decision `id`,
 * actor, client event, idempotency), or finding-decision outbox tips
 * (#785 / #786).
 *
 * Only ASCII end trim is pinned before the existing allowlist check; case is
 * left unchanged so unknown casing still fails closed. Max lengths stay 16 /
 * 32 / 16 to match the prior `requireBoundedText` bounds.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized finding-decision response enum token before
 * the allowlist check in response normalization.
 */
export function asciiTrimOperationalFindingDecisionResponseEnumToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a finding-decision response enum token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperationalFindingDecisionResponseEnumToken(
  value: string,
  maxLength: number
): string | null {
  const trimmed = asciiTrimOperationalFindingDecisionResponseEnumToken(value);
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed decision type require for finding-decision response normalize.
 * Preserves the stable `Finding decision type is invalid.` contract and the
 * existing 16-character bound. Allowlist membership remains the caller's
 * responsibility so this tip does not rewrite enum error wording.
 */
export function requireCanonicalOperationalFindingDecisionType(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding decision type is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionResponseEnumToken(value, 16);
  if (!text) {
    throw new Error("Finding decision type is invalid.");
  }
  return text;
}

/**
 * Fail-closed finding category require for finding-decision response normalize.
 * Preserves the stable `Finding category is invalid.` contract and the
 * existing 32-character bound.
 */
export function requireCanonicalOperationalFindingCategory(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Finding category is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionResponseEnumToken(value, 32);
  if (!text) {
    throw new Error("Finding category is invalid.");
  }
  return text;
}

/**
 * Fail-closed severity require for finding-decision response normalize.
 * Preserves the stable `Finding severity is invalid.` contract and the
 * existing 16-character bound.
 */
export function requireCanonicalOperationalFindingSeverity(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Finding severity is invalid.");
  }
  const text = canonicalizeOperationalFindingDecisionResponseEnumToken(value, 16);
  if (!text) {
    throw new Error("Finding severity is invalid.");
  }
  return text;
}
