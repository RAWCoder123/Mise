/**
 * Export-restaurant-data error-message free-text helpers (MISE-005SU).
 *
 * Pins repository-layer export-restaurant-data Edge `payload.error` haystacks
 * outside `exportRestaurantData` so Node tests can exercise inventing proofs
 * without loading account-deletion / Gmail / Square siblings. Prior path
 * Unicode-trimmed `payload.error` before becoming the operator-facing
 * `Error` message
 * (`'\u2003Restaurant data could not be exported. Try again.\u2003'.trim() ===
 * 'Restaurant data could not be exported. Try again.'`).
 *
 * Export-restaurant-data error haystacks are multiline system free-text
 * (parity with open MISE-005SS account-deletion error messages /
 * MISE-005SR Gmail / MISE-005SQ Square integration error messages /
 * MISE-005SP recalculation describeError / MISE-005SO schedule failure
 * reasons): fold NBSP to a plain space, then trim only C-locale `[[:space:]]`
 * from the ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded diagnostic. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Soft empty after prep falls through to
 * the caller-supplied fallback so the prior
 * `payload.error.trim().length > 0 ? payload.error.trim().slice(0, 320) :
 * fallback` contract is preserved. Unsafe-control tokens also soft to that
 * fallback so a bad Edge payload cannot crash export error projection. Max
 * length stays 320 to match the prior `.trim().slice(0, 320)` bound.
 *
 * Complements open account-deletion tip (#931 / MISE-005SS), Gmail tip
 * (#930 / MISE-005SR), Square tip (#929 / MISE-005SQ), recalculation
 * describeError tip (#928 / MISE-005SP), and schedule failure-reason tip
 * (#927 / MISE-005SO) without sharing those modules. Intentionally leaves
 * account-deletion `payload.error` / `deletionReference`, Gmail, and Square
 * haystacks alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Prior export-restaurant-data error message length bound. */
export const EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS = 320;

/**
 * Canonical free-text for export-restaurant-data error haystacks. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded diagnostic and
 * internal newlines stay intact.
 */
export function canonicalExportRestaurantDataErrorMessage(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for export-restaurant-data error haystacks. Preserves soft
 * empty → null (prior `.trim()` emptiness → fallback) while refusing to invent
 * a clean diagnostic via Unicode em-space trim. Does not throw; unsafe
 * controls soft to null so error projection stays available. Truncates to the
 * prior 320-character bound after ASCII C prep rather than after inventing
 * Unicode trim.
 */
export function normalizeExportRestaurantDataErrorMessage(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the caller fallback. Do not invent a one-character
  // diagnostic.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalExportRestaurantDataErrorMessage(value);
  if (!prepared) return null;
  return prepared.slice(0, EXPORT_RESTAURANT_DATA_ERROR_MESSAGE_MAX_CHARACTERS);
}

/**
 * Resolve the operator-facing export-restaurant-data error message. Soft empty
 * / unsafe / non-string fall through to the caller-supplied fallback (prior
 * emptiness → fallback contract).
 */
export function resolveExportRestaurantDataErrorMessage(
  candidateMessage: string | null | undefined,
  fallbackMessage: string
): string {
  return normalizeExportRestaurantDataErrorMessage(candidateMessage) ?? fallbackMessage;
}
