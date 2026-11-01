/**
 * Orders detail sent-note `orders.detail.note.none` display helpers (MISE-005VE).
 *
 * Pins the Orders detail read-only sent-note branch that previously selected
 * display text with raw truthiness before the intentional localized fallback:
 * `visibleOrder.operator_note || t("orders.detail.note.none")`.
 *
 * A Unicode-only-space note (`"\u2003"`) is raw-truthy
 * (`Boolean("\u2003") === true`) while `.trim()` empties it, so the
 * intentional `orders.detail.note.none` copy was bypassed and sent-order chrome
 * could render a blank-looking note body. Separately, Unicode `.trim()` on
 * padded notes (`"\u2003Call on arrival\u2003".trim() === "Call on arrival"`)
 * would invent a clean display body if that gate Unicode-trimmed before
 * interpolation.
 *
 * Operator notes are multiline free-text (parity with open write-path tip
 * #840 / MISE-005PF and SQL cntrl pin #551): fold NBSP to a plain space, then
 * trim only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded note. Accents
 * and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in supplier notes.
 *
 * These are presentation **orders.detail.note.none** display tokens only —
 * not the write/persist / dirty-check path owned by #840, not
 * `generatedOrderMessage` display trim (#840 left alone), not Orders
 * delivery-evidence timezone (#1010), not email-review body
 * `|| t("orders.detail.review.unavailable")`, and not sibling free-text tips
 * (deliveryHistory / floor-notes / waste / count-line). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("orders.detail.note.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #840 / #1010 / #670 on `app/orders/[id].tsx` without
 * sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for Orders detail note.none display.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean sent-note body and
 * internal newlines stay intact.
 */
export function asciiPrepOrdersDetailNoteNone(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a sent-note display token under ASCII C multiline prep.
 * Returns null when empty after prep, still Unicode-padded, or containing
 * disallowed controls.
 */
export function canonicalizeOrdersDetailNoteNone(value: string): string | null {
  const prepared = asciiPrepOrdersDetailNoteNone(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one Orders detail note.none display candidate.
 * Preserves soft empty → null (intentional localized orders.detail.note.none
 * copy) while refusing to invent a clean note body via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("orders.detail.note.none")` branch owns the fallback without
 * inventing a clean sent-note identity from padding, and without letting raw
 * truthy Unicode-only space bypass that fallback.
 */
export function normalizeOrdersDetailNoteNone(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously bypassed the intentional localized orders.detail.note.none copy.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailNoteNone(value);
}
