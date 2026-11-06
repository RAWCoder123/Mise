/**
 * Inventory count session catch Error.message helpers (MISE-005YI).
 *
 * Pins Inventory count operator-facing catch-error projection outside the Expo
 * UI graph so Node tests can exercise inventing and fallback-bypass proofs
 * without loading React Native.
 *
 * Prior path forced the raw Error.message whenever the catch value was an
 * Error, with no ASCII C prep, soft-null, or length bound:
 * `caught instanceof Error ? caught.message : t("inventory.count.*Error")`
 *
 * That invents operator-facing notices from empty, Unicode-only-space, and
 * em-space/NBSP-padded diagnostics, and bypasses the intentional localized
 * start/save/submit/approve/cancel fallbacks. Soft empty
 * (`new Error("")`, `new Error("\u2003")`) previously rendered a blank or
 * invisible notice instead of the localized catalog copy. Em-space padding
 * (`"\u2003Count submit failed.\u2003"`) displayed as a padded diagnostic
 * without a proven clean token. Soft-null restores the localized fallthrough
 * when the diagnostic cannot be proven without inventing.
 *
 * Count-session error haystacks are multiline system free-text (parity with
 * open Inventory detail / Log Delivery submitError and recalculation
 * describeError tips): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded diagnostic. Accents and case are
 * preserved so intentional `throw new Error(t(...))` validation copy still
 * displays after ASCII C prep.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks a system error may carry into the count-session notice.
 *
 * These are Inventory count **session catch Error.message** presentation
 * tokens only — the start / save / submit / approve / cancel catch notices
 * that previously projected raw `caught.message`. Not Inventory detail
 * submitError (#1139 / MISE-005YG — leave alone), not Log Delivery
 * submitError (#1140 / MISE-005YH — leave alone), not count-sheet note ASCII C
 * (#885), not inventory/orders `message ?? notFound`, not recalculation /
 * account-deletion / Gmail / Square Edge error haystacks. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `t("inventory.count.*Error")` branch owns the intentional localized
 * fallback when the diagnostic cannot be proven without inventing. Ordinary
 * ASCII whitespace still trims clean. Max length is 220 to match sibling
 * submitError tips, applied after ASCII C prep (prior path had no bound).
 *
 * Complements open Inventory detail submitError (#1139), Log Delivery
 * submitError (#1140), #928 / #931 / #930 / #929, and count-sheet note tips
 * without sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Inventory count session catch Error.message length bound (sibling parity). */
export const INVENTORY_COUNT_SESSION_ERROR_MESSAGE_MAX_CHARACTERS = 220;

/**
 * Canonical free-text for Inventory count session catch Error.message haystacks.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * diagnostic and internal newlines stay intact.
 */
export function canonicalInventoryCountSessionErrorMessage(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Inventory count session catch `Error.message`. Preserves
 * soft empty → null (intentional localized `inventory.count.*Error`
 * fallthrough) while refusing to invent a clean diagnostic via Unicode
 * em-space trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live localized fallback owns the notice without inventing
 * a clean gate from padding, and without letting empty / Unicode-only space
 * force a blank raw-message notice through the prior `instanceof Error`
 * branch. Truncates to the 220-character bound after ASCII C prep.
 */
export function normalizeInventoryCountSessionErrorMessage(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior path displayed
  // the raw token. Do not invent a one-character or blank diagnostic.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalInventoryCountSessionErrorMessage(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded diagnostic on this notice path.
  if (prepared !== prepared.trim()) return null;
  return prepared.slice(0, INVENTORY_COUNT_SESSION_ERROR_MESSAGE_MAX_CHARACTERS);
}

/**
 * Resolve the operator-facing Inventory count session catch-error notice.
 * Soft empty / unsafe / non-string / Unicode-padded fall through to the
 * caller-supplied localized fallback (prior emptiness still took the raw
 * Error.message branch via `instanceof Error`).
 */
export function resolveInventoryCountSessionErrorMessage(
  candidateMessage: string | null | undefined,
  fallbackMessage: string
): string {
  return normalizeInventoryCountSessionErrorMessage(candidateMessage) ?? fallbackMessage;
}

/**
 * Never-null Inventory count session catch-error projection from a caught
 * value. Only Error.message candidates are considered; other throw shapes soft
 * to the localized fallback (matching the prior `instanceof Error ? …`
 * gate).
 */
export function describeInventoryCountSessionError(
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof Error) {
    return resolveInventoryCountSessionErrorMessage(error.message, fallbackMessage);
  }
  return fallbackMessage;
}
