/**
 * Mise-actions rollbackReference identity helpers (MISE-005NS).
 *
 * Pins domain-layer `markReversed` `rollbackReference` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase or
 * demo storage. Reversal previously Unicode-trimmed `rollbackReference`, so
 * NBSP/em-space padding invented a valid durable reverse reference used as
 * action-ledger rollback authority.
 *
 * Intentionally does not change restaurant workspace (#738 / MISE-005LH),
 * subjectId / idempotencyKey / actionId (#772 / MISE-005MP), approvedBy
 * (#800 / MISE-005NR), error message free-text, lesson free-text, or
 * requestedBy. Those remain on their existing contracts in this tip.
 *
 * Rollback references are opaque durable tokens (for example `rollback_1`),
 * not UUID-shaped on every path. Only ASCII end trim is pinned; case is left
 * unchanged so unknown casing still fails closed downstream. Max length stays
 * 240 to match the MISE-005FN CHECK bound (`length(trim(...)) between 1 and
 * 240`). Empty-after-trim fails closed — a reversal must carry a real
 * reference rather than inventing an empty string via Unicode space collapse.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Mise-action rollback reference before it is
 * stored as durable reverse authority.
 */
export function asciiTrimMiseActionsRollbackReferenceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Mise-action rollbackReference under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeMiseActionsRollbackReference(
  value: string
): string | null {
  const trimmed = asciiTrimMiseActionsRollbackReferenceToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 240) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed rollbackReference require for markReversed.
 * Refuses Unicode-padded tokens that would invent a durable reverse reference
 * and refuses soft-empty values that would store an empty string.
 * Error contract: `Mise action rollbackReference is invalid.`
 */
export function requireCanonicalMiseActionsRollbackReference(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Mise action rollbackReference is invalid.");
  }
  const canonical = canonicalizeMiseActionsRollbackReference(value);
  if (!canonical) {
    throw new Error("Mise action rollbackReference is invalid.");
  }
  return canonical;
}
