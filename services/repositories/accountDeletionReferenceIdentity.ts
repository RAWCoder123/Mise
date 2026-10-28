/**
 * Account-deletion deletionReference identity helpers (MISE-005ST).
 *
 * Pins repository-layer account-deletion Edge `payload.deletionReference`
 * haystacks outside `deleteAccount` so Node tests can exercise inventing
 * proofs without loading account-deletion error-message (#931), export
 * restaurant-data error, Gmail, or Square siblings. Prior path
 * Unicode-trimmed `payload.deletionReference` before appending it into the
 * operator-facing `Error` message as `Reference: …`
 * (`'\u2003a1b2c3d4-e5f6-4789-a012-3456789abcde\u2003'.trim() ===
 * 'a1b2c3d4-e5f6-4789-a012-3456789abcde'`). Soft empty / Unicode-only space
 * also invented the no-Reference branch via `'\u2003'.trim() === ''`.
 *
 * These are support **reference identities** (durable audit IDs) — not
 * account-deletion `payload.error` free-text (#931 / MISE-005SS), not export
 * restaurant-data `payload.error`, and not Gmail / Square integration error
 * messages. Soft empty (missing, non-string, `""`, ASCII whitespace, or
 * Unicode-only space) keeps the prior empty-string contract so the Error
 * message omits `Reference:`. Ordinary ASCII whitespace still trims clean
 * before the 80-character bound. Unicode-padded or control-bearing tokens
 * soft to empty so padded audit IDs cannot invent a reviewed support
 * reference into the operator-facing Error.
 *
 * Complements open account-deletion error-message tip (#931 / MISE-005SS)
 * without sharing that module. Intentionally leaves export-restaurant-data
 * `payload.error` alone for a separate tip.
 */

/** Prior account-deletion deletionReference length bound. */
export const ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS = 80;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized account-deletion support reference before
 * operator-facing Error projection.
 */
export function asciiTrimAccountDeletionReference(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an account-deletion deletionReference under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * control-bearing. Truncates to the prior 80-character bound after ASCII C
 * prep rather than after inventing Unicode trim.
 */
export function canonicalizeAccountDeletionReference(
  value: string
): string | null {
  const trimmed = asciiTrimAccountDeletionReference(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed.slice(0, ACCOUNT_DELETION_REFERENCE_MAX_CHARACTERS);
}

/**
 * Soft normalize for account-deletion deletionReference haystacks. Preserves
 * soft empty → null (prior `.trim()` emptiness → `""` / no Reference) while
 * refusing to invent a clean support reference via Unicode em-space / NBSP
 * trim. Does not throw; unsafe tokens soft to null so Error projection stays
 * available without inventing `Reference: {clean-id}`.
 */
export function normalizeAccountDeletionReference(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the no-Reference branch. Do not invent a reference.
  if (!value.trim()) return null;
  return canonicalizeAccountDeletionReference(value);
}

/**
 * Resolve the account-deletion support reference for Error projection.
 * Soft empty / unsafe / inventing padding fall through to `""` so the prior
 * falsy check omits `Reference:` (prior non-string / empty-trim contract).
 */
export function resolveAccountDeletionReference(
  candidateReference: string | null | undefined
): string {
  return normalizeAccountDeletionReference(candidateReference) ?? "";
}
