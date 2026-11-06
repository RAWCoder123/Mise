/**
 * Log Delivery submitError.message helpers (MISE-005YH).
 *
 * Pins Log Delivery operator-facing submit-error projection outside the Expo
 * UI graph so Node tests can exercise inventing and fallback-bypass proofs
 * without loading React Native.
 *
 * Prior path Unicode-trimmed `Error.message` only as a presence gate, then
 * displayed the raw untrimmed slice:
 * `submitError instanceof Error && submitError.message.trim()
 *   ? submitError.message.slice(0, 220)
 *   : t("inventory.ops.submitError")`
 *
 * Unicode `.trim()` on a padded diagnostic
 * (`"\u2003Queue flush failed while recording the receipt.\u2003".trim() ===
 * "Queue flush failed while recording the receipt."`)
 * invents clean gate presence and forces the raw Error.message branch. Soft
 * empty / Unicode-only-space messages (`"\u2003"`) already fell through via
 * falsy `.trim()`, but soft-null keeps that intentional localized
 * `inventory.ops.submitError` fallthrough explicit and refuses to invent a
 * clean diagnostic from em-space / NBSP padding before display.
 *
 * Submit-error haystacks are multiline system free-text (parity with open
 * Inventory detail submitError / account-deletion / Gmail / Square /
 * recalculation describeError tips): fold NBSP to a plain space, then trim
 * only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded diagnostic.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks a system error may carry into the Log Delivery notice.
 *
 * These are Log Delivery **submitError.message** presentation tokens only —
 * the catch-path operator notice that previously gated on Unicode `.trim()`
 * then sliced the raw Error.message. Not Inventory detail's twin submitError
 * path (#1139 / MISE-005YG — leave alone), not Log Delivery history/selected/
 * pick-list itemName tips (#1059/#1060/#1062), not Log Delivery note/quantity
 * tips (#886/#891), not recalculation describeError (#928), not
 * account-deletion / Gmail / Square Edge error haystacks. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `t("inventory.ops.submitError")` branch owns the intentional localized
 * fallback when the diagnostic cannot be proven without inventing. Ordinary
 * ASCII whitespace still trims clean. Max length stays 220 to match the prior
 * `.slice(0, 220)` bound, applied after ASCII C prep.
 *
 * Complements open Inventory detail submitError (#1139), #928 / #931 / #930 /
 * #929, and Log Delivery quantity/note tips without sharing those modules or
 * rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Prior Log Delivery submitError.message length bound. */
export const LOG_DELIVERY_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS = 220;

/**
 * Canonical free-text for Log Delivery submitError.message haystacks.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * diagnostic and internal newlines stay intact.
 */
export function canonicalLogDeliverySubmitErrorMessage(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Log Delivery `submitError.message`. Preserves soft empty
 * → null (intentional localized `inventory.ops.submitError` fallthrough) while
 * refusing to invent a clean diagnostic via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * localized fallback owns the notice without inventing a clean gate from
 * padding, and without letting non-nullish Unicode-only space force a blank
 * raw-slice notice through the prior `.trim()` path. Truncates to the prior
 * 220-character bound after ASCII C prep.
 */
export function normalizeLogDeliverySubmitErrorMessage(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()` already
  // emptied those into the localized submitError fallback. Do not invent a
  // one-character diagnostic.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalLogDeliverySubmitErrorMessage(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded diagnostic on this notice path.
  if (prepared !== prepared.trim()) return null;
  return prepared.slice(0, LOG_DELIVERY_SUBMIT_ERROR_MESSAGE_MAX_CHARACTERS);
}

/**
 * Resolve the operator-facing Log Delivery submit-error notice. Soft empty /
 * unsafe / non-string / Unicode-padded fall through to the caller-supplied
 * localized fallback (prior emptiness → `t("inventory.ops.submitError")`).
 */
export function resolveLogDeliverySubmitErrorMessage(
  candidateMessage: string | null | undefined,
  fallbackMessage: string
): string {
  return normalizeLogDeliverySubmitErrorMessage(candidateMessage) ?? fallbackMessage;
}

/**
 * Never-null Log Delivery submit-error projection from a caught value.
 * Only Error.message candidates are considered; other throw shapes soft to the
 * localized fallback (matching the prior `instanceof Error && …` gate).
 */
export function describeLogDeliverySubmitError(
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof Error) {
    return resolveLogDeliverySubmitErrorMessage(error.message, fallbackMessage);
  }
  return fallbackMessage;
}
