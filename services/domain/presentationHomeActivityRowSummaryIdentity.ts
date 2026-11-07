/**
 * Home ActivityRow event.summary helpers (MISE-005YS).
 *
 * Pins Home live-activity row-summary presentation that previously always
 * passed raw `event.summary` into the summary Text:
 * `<Text style={styles.activitySummary} numberOfLines={2}>{event.summary}</Text>`
 *
 * A Unicode-only-space activity summary (`"\u2003"`) is non-nullish and still
 * rendered as the entire summary line, so blank-looking summary copy appeared
 * on Home Activity rows with no intentional localized fallback. Empty string
 * has the same blank-body bypass. Separately, Unicode `.trim()` on a padded
 * summary
 * (`"\u2003Chicken Breast counted at 18 lb.\u2003".trim() ===
 * "Chicken Breast counted at 18 lb."`) would invent a clean display summary if
 * that gate Unicode-trimmed before rendering into the Home ActivityRow
 * summary Text.
 *
 * Summaries are multiline operator / system free-text (parity with Activity
 * hub row event.summary tip #1150 / MISE-005YR and Daily Brief Board
 * finding.explanation tip #1142 / MISE-005YJ): fold NBSP to a plain space,
 * then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded
 * summary. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks activity summaries may carry into Home Activity rows.
 *
 * These are presentation **home.activity.row.summary.none** summary tokens
 * only — the Home ActivityRow `event.summary` that falls through to that
 * fallback when soft-null. Not Home ActivityRow event.title (#1149 /
 * MISE-005YQ), not Activity hub row event.summary (#1150 / MISE-005YR), not
 * Activity hub row event.title (#1148 / MISE-005YP), not Activity expand a11y
 * event.title (#1071 / MISE-005XK), not create-task list-row a11y `task.title`
 * (#1072), and not Home ApprovalsSection card.title (#1049). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("home.activity.row.summary.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1150 / #1149 / #1148 / #1071 / #1049 / #1072 / #1142
 * without sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Home ActivityRow event summaries. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded summary and
 * internal newlines stay intact.
 */
export function canonicalHomeActivityRowSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Home ActivityRow `event.summary` display. Preserves soft
 * empty → null (intentional localized home.activity.row.summary.none copy)
 * while refusing to invent a clean summary via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("home.activity.row.summary.none")` branch owns the fallback without
 * inventing a clean Home ActivityRow summary from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking
 * summary through the prior always-pass-summary row.
 */
export function normalizeHomeActivityRowSummary(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the summary Text instead of the intentional
  // localized home.activity.row.summary.none copy.
  // Do not invent a clean Home ActivityRow summary from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalHomeActivityRowSummary(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded summary on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
