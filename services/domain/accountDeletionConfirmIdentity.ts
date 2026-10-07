/**
 * Settings account-deletion confirmation-word identity.
 *
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KG). Only ASCII A-Z is folded; end trim uses only ASCII
 * whitespace (`[ \t\n\r\f\v]`). Unicode-aware `String#trim` /
 * `toLowerCase` would strip NBSP / em-space padding and invent a
 * confirmation match that enables the irreversible delete control.
 *
 * Confirmation words are locale catalog strings (EN `DELETE`, ES
 * `ELIMINAR`, ZH `删除`). Non-ASCII letters are preserved as-is so
 * Mandarin and accented copy still compare correctly after ASCII C fold.
 */

/**
 * Trim only ASCII whitespace so confirmation tokens stay aligned with
 * sibling COLLATE "C" btrim tips. Mid-string non-C whitespace is
 * preserved so em-space / NBSP cannot invent equality.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Normalize one account-deletion confirmation token to ASCII C case fold
 * + ASCII-only end trim.
 */
export function normalizeAccountDeletionConfirmToken(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return asciiCLower(asciiCTrim(value));
}

/**
 * True when typed input matches the expected confirmation word under
 * ASCII C identity. Empty / whitespace-only input never matches.
 */
export function matchesAccountDeletionConfirmWord(
  typed: string | null | undefined,
  expectedWord: string | null | undefined
): boolean {
  const normalizedTyped = normalizeAccountDeletionConfirmToken(typed);
  const normalizedExpected = normalizeAccountDeletionConfirmToken(expectedWord);
  if (!normalizedTyped || !normalizedExpected) return false;
  return normalizedTyped === normalizedExpected;
}
