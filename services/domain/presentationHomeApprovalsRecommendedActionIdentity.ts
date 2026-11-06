/**
 * Home ApprovalsSection card.recommendedAction helpers (MISE-005YB).
 *
 * Pins Home ApprovalsSection approval-card recommended-action presentation that
 * previously always passed raw `card.recommendedAction` into the cardBody Text:
 * `<Text style={styles.cardBody}>{card.recommendedAction}</Text>`
 *
 * A Unicode-only-space recommended action (`"\u2003"`) is non-nullish and still
 * rendered as the entire cardBody line, so blank-looking action copy appeared
 * on Needs-your-approval cards with no intentional localized fallback. Empty
 * string has the same blank-body bypass. Separately, Unicode `.trim()` on a
 * padded recommended action
 * (`"\u2003Order 12 lb from Fresh Produce Co.\u2003".trim() === "Order 12 lb from Fresh Produce Co."`)
 * would invent a clean display recommended action if that gate Unicode-trimmed
 * before rendering into the ApprovalsSection cardBody.
 *
 * Recommended actions are multiline operator / system free-text (parity with
 * open finding recommended-action domain tip #832 / MISE-005OX, Daily Brief
 * recommended-action edit tip #884 / MISE-005QX, and Daily Ops signal-line tip
 * #867 / MISE-005QG): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded recommended action. Accents and case
 * are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks finding recommended actions may carry into Home approval cards.
 *
 * These are presentation **home.approvals.recommendedAction.none** recommended-
 * action tokens only — the Home ApprovalsSection `card.recommendedAction` that
 * falls through to that fallback when soft-null. Not Home ApprovalsSection
 * card.title (#1049 / MISE-005WO), not whyItMatters body copy, not Home
 * StatusNotice approval titles (#1011 / MISE-005VC), not Home greeting
 * restaurant.name (#1044 / MISE-005WJ), not finding recommended-action domain
 * require paths (#832), not Daily Brief edit normalize (#884). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("home.approvals.recommendedAction.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1049 / #1011 / #1044 / #832 / #884 / #867 without sharing
 * those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Home ApprovalsSection recommended actions. Folds
 * NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded
 * recommended action and internal newlines stay intact.
 */
export function canonicalHomeApprovalsRecommendedAction(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Home ApprovalsSection `card.recommendedAction` display.
 * Preserves soft empty → null (intentional localized recommendedAction.none
 * copy) while refusing to invent a clean recommended action via Unicode
 * em-space trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("home.approvals.recommendedAction.none")`
 * branch owns the fallback without inventing a clean ApprovalsSection
 * recommended action from padding, and without letting non-nullish
 * Unicode-only space or empty string render a blank-looking cardBody through
 * the prior always-pass-recommendedAction row.
 */
export function normalizeHomeApprovalsRecommendedAction(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the cardBody Text instead of the intentional
  // localized recommendedAction.none copy.
  // Do not invent a clean Home ApprovalsSection recommended action from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalHomeApprovalsRecommendedAction(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded recommended action on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
