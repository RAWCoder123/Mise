/**
 * Home ApprovalsSection card.whyItMatters helpers (MISE-005YC).
 *
 * Pins Home ApprovalsSection approval-card why-it-matters presentation that
 * previously always passed raw `card.whyItMatters` into the metaLine Text:
 * `<Text style={styles.metaLine}>{t("home.approvals.why")}: {card.whyItMatters}</Text>`
 *
 * A Unicode-only-space why-it-matters string (`"\u2003"`) is non-nullish and
 * still rendered after the localized "Why it matters" label, so blank-looking
 * why copy appeared on Needs-your-approval cards with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded why-it-matters string
 * (`"\u2003Lunch usage was 24% above forecast.\u2003".trim() === "Lunch usage was 24% above forecast."`)
 * would invent a clean display reason if that gate Unicode-trimmed before
 * rendering into the ApprovalsSection metaLine.
 *
 * Why-it-matters strings are multiline operator / system free-text (parity with
 * Home Approvals recommendedAction tip #1134 / MISE-005YB, open finding
 * recommended-action domain tip #832 / MISE-005OX, Daily Brief recommended-
 * action edit tip #884 / MISE-005QX, and Daily Ops signal-line tip #867 /
 * MISE-005QG): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded why-it-matters string. Accents and
 * case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks finding / brief why copy may carry into Home approval cards.
 *
 * These are presentation **home.approvals.whyItMatters.none** why-it-matters
 * tokens only — the Home ApprovalsSection `card.whyItMatters` that falls through
 * to that fallback when soft-null. Not Home ApprovalsSection card.title
 * (#1049 / MISE-005WO), not card.recommendedAction (#1134 / MISE-005YB), not
 * Home StatusNotice approval titles (#1011 / MISE-005VC) or StatusNotice
 * `primaryApproval?.whyItMatters` message pass-through, not Home greeting
 * restaurant.name (#1044 / MISE-005WJ), not finding recommended-action domain
 * require paths (#832), not Daily Brief edit normalize (#884). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("home.approvals.whyItMatters.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1049 / #1134 / #1011 / #1044 / #832 / #884 / #867 without
 * sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Home ApprovalsSection why-it-matters copy. Folds
 * NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded
 * why-it-matters string and internal newlines stay intact.
 */
export function canonicalHomeApprovalsWhyItMatters(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Home ApprovalsSection `card.whyItMatters` display.
 * Preserves soft empty → null (intentional localized whyItMatters.none copy)
 * while refusing to invent a clean why-it-matters string via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("home.approvals.whyItMatters.none")` branch owns the
 * fallback without inventing a clean ApprovalsSection why-it-matters string
 * from padding, and without letting non-nullish Unicode-only space or empty
 * string render a blank-looking metaLine through the prior always-pass-
 * whyItMatters row.
 */
export function normalizeHomeApprovalsWhyItMatters(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered after the "Why it matters" label instead of the
  // intentional localized whyItMatters.none copy.
  // Do not invent a clean Home ApprovalsSection why-it-matters string from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalHomeApprovalsWhyItMatters(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded why-it-matters string on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
