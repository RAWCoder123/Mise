/**
 * Mise-actions approvedBy identity helpers (MISE-005NR).
 *
 * Pins domain-layer `markApproved` / `markRejected` `approvedBy` outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Approval previously Unicode-trimmed `approvedBy`,
 * so NBSP/em-space padding invented a valid approver identity used as durable
 * action-attribution authority.
 *
 * Intentionally does not change restaurant workspace (#738 / MISE-005LH),
 * subjectId / idempotencyKey / actionId (#772 / MISE-005MP), rollbackReference,
 * error message free-text, lesson free-text, or requestedBy. Those remain on
 * their existing contracts in this tip.
 *
 * Approver identities are UUID-shaped on the hosted path but may be other
 * durable tokens in fixtures. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Max length stays
 * 64. Empty-after-trim remains soft-null for markApproved and soft-fallback for
 * markRejected.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Mise-action approver identity before it is
 * stored as durable approval attribution authority.
 */
export function asciiTrimMiseActionsApprovedByToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Mise-action approvedBy identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeMiseActionsApprovedBy(
  value: string
): string | null {
  const trimmed = asciiTrimMiseActionsApprovedByToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 64) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed approvedBy normalize for markApproved / markRejected.
 * Preserves soft empty → null (`approvedBy.trim() || null` / fallback) while
 * refusing Unicode-padded tokens that would invent a durable approver identity.
 * Error contract: `Mise action approvedBy is invalid.`
 */
export function normalizeCanonicalMiseActionsApprovedBy(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    throw new Error("Mise action approvedBy is invalid.");
  }
  const canonical = canonicalizeMiseActionsApprovedBy(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Mise action approvedBy is invalid.");
}
