/**
 * Orders detail email-review body `orders.detail.review.unavailable` display
 * helpers (MISE-005VF).
 *
 * Pins the Orders detail draft email-review body branch that previously
 * selected display text with raw truthiness before the intentional localized
 * fallback: `visibleEmailPayload?.body || t("orders.detail.review.unavailable")`.
 *
 * A Unicode-only-space body (`"\u2003"`) is raw-truthy
 * (`Boolean("\u2003") === true`) while `.trim()` empties it, so the
 * intentional `orders.detail.review.unavailable` copy was bypassed and the
 * email-review panel could render a blank-looking body. Separately, Unicode
 * `.trim()` on padded bodies
 * (`"\u2003Please deliver before 10am\u2003".trim() === "Please deliver before 10am"`)
 * would invent a clean display body if that gate Unicode-trimmed before
 * interpolation.
 *
 * Supplier email bodies are multiline free-text (parity with open sent-note tip
 * #1013 / MISE-005VE and SQL cntrl pin #551): fold NBSP to a plain space, then
 * trim only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded body. Accents
 * and case are preserved.
 *
 * Control gate matches the operator_note / order-message multiline allowlist:
 * reject C0 controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject
 * the same line breaks operators need in supplier email bodies.
 *
 * These are presentation **orders.detail.review.unavailable** email-body
 * display tokens only — not from/to/subject `??` rows (mailbox / header tips
 * preserve NBSP), not sent-note `orders.detail.note.none` (#1013), not
 * supplier operator_note write/persist (#840), not `generatedOrderMessage`
 * display trim, not Orders delivery-evidence timezone (#1010), and not
 * receive-discrepancy (#670). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("orders.detail.review.unavailable")`
 * branch owns the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1013 / #840 / #1010 / #670 on `app/orders/[id].tsx`
 * without sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (order-message parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for Orders detail email-review body display.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean email body and
 * internal newlines stay intact.
 */
export function asciiPrepOrdersDetailEmailReviewBody(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize an email-review body display token under ASCII C multiline prep.
 * Returns null when empty after prep, still Unicode-padded, or containing
 * disallowed controls.
 */
export function canonicalizeOrdersDetailEmailReviewBody(value: string): string | null {
  const prepared = asciiPrepOrdersDetailEmailReviewBody(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one Orders detail email-review body display candidate.
 * Preserves soft empty → null (intentional localized
 * orders.detail.review.unavailable copy) while refusing to invent a clean
 * email body via Unicode em-space trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("orders.detail.review.unavailable")` branch owns the fallback without
 * inventing a clean email-body identity from padding, and without letting raw
 * truthy Unicode-only space bypass that fallback.
 */
export function normalizeOrdersDetailEmailReviewBody(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously bypassed the intentional localized review.unavailable copy.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailEmailReviewBody(value);
}
