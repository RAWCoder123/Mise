/**
 * Daily Brief Board finding.explanation helpers (MISE-005YJ).
 *
 * Pins Daily Brief Board finding-card explanation presentation that previously
 * always passed raw `finding.explanation` into the cardBody Text:
 * `<Text style={styles.cardBody}>{finding.explanation}</Text>`
 *
 * A Unicode-only-space explanation (`"\u2003"`) is non-nullish and still
 * rendered as the entire cardBody line, so blank-looking explanation copy
 * appeared on Daily Brief finding cards with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded explanation
 * (`"\u2003Chicken Breast has less than one service day of projected coverage.\u2003".trim() ===
 * "Chicken Breast has less than one service day of projected coverage."`)
 * would invent a clean display explanation if that gate Unicode-trimmed before
 * rendering into the Board cardBody.
 *
 * Explanations are multiline operator / system free-text (parity with open
 * operational-findings explanation domain tip #921 / MISE-005SI, Home
 * Approvals recommendedAction presentation tip #1134 / MISE-005YB, and Daily
 * Brief recommended-action edit tip #884 / MISE-005QX): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded
 * explanation. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks finding explanations may carry into Daily Brief Board cards.
 *
 * These are presentation **dailyBrief.explanation.none** explanation tokens
 * only — the Daily Brief Board `finding.explanation` that falls through to
 * that fallback when soft-null. Not operational-findings domain explanation
 * boundedText (#921 / MISE-005SI), not finding.title (#920), not
 * recommendedAction domain (#922) or edit (#884), not recommendedAction Board
 * display / a11y, not effectiveRecommendedAction annotation, not Daily Phase
 * Brief finding.interpretation (#1085). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.explanation.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #921 / #922 / #920 / #884 / #1134 / #1085 without sharing
 * those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Daily Brief Board finding explanations. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded explanation and
 * internal newlines stay intact.
 */
export function canonicalDailyBriefBoardExplanation(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Brief Board `finding.explanation` display. Preserves
 * soft empty → null (intentional localized explanation.none copy) while
 * refusing to invent a clean explanation via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyBrief.explanation.none")` branch owns the fallback without
 * inventing a clean Board explanation from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking
 * cardBody through the prior always-pass-explanation row.
 */
export function normalizeDailyBriefBoardExplanation(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the cardBody Text instead of the intentional
  // localized explanation.none copy.
  // Do not invent a clean Daily Brief Board explanation from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyBriefBoardExplanation(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded explanation on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
