/**
 * Daily Brief Board managerFeedback.effectiveRecommendedAction helpers (MISE-005YL).
 *
 * Pins Daily Brief Board finding-card manager-annotation presentation that
 * previously always passed raw
 * `finding.managerFeedback.effectiveRecommendedAction` into the annotation
 * Text:
 * `<Text style={styles.annotation}>{finding.managerFeedback.effectiveRecommendedAction}</Text>`
 *
 * A Unicode-only-space annotation (`"\u2003"`) is non-nullish and still
 * rendered as the entire manager-note line, so blank-looking annotation copy
 * appeared on Daily Brief finding cards with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded annotation
 * (`"\u2003Count basil before dinner service\u2003".trim() ===
 * "Count basil before dinner service"`)
 * would invent a clean display annotation if that gate Unicode-trimmed
 * before rendering into the Board annotation Text.
 *
 * Effective recommended actions are multiline manager / system free-text
 * (parity with Board recommendedAction presentation tip #1143 / MISE-005YK,
 * open operational-findings recommendedAction domain tip #922 / MISE-005SJ,
 * Daily Brief recommended-action edit tip #884 / MISE-005QX, Home Approvals
 * recommendedAction presentation tip #1134 / MISE-005YB, and Daily Brief Board
 * explanation presentation tip #1142 / MISE-005YJ): fold NBSP to a plain space,
 * then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded
 * annotation. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks manager annotations may carry into Daily Brief Board cards.
 *
 * These are presentation **dailyBrief.feedback.effectiveRecommendedAction.none**
 * annotation tokens only — the Daily Brief Board
 * `finding.managerFeedback.effectiveRecommendedAction` that falls through to
 * that fallback when soft-null. Not Board recommendedAction display
 * (#1143 / MISE-005YK), not operational-findings domain recommendedAction
 * (#922 / MISE-005SJ), not Daily Brief edit normalize (#884 / MISE-005QX),
 * not finding.title (#920), not Board explanation display (#1142 / MISE-005YJ),
 * not domain explanation (#921), not Home Approvals recommendedAction (#1134),
 * not Daily Phase Brief finding.interpretation (#1085). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.feedback.effectiveRecommendedAction.none")` branch owns
 * the intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1143 / #922 / #884 / #920 / #921 / #1142 / #1134 / #1085
 * without sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Daily Brief Board manager annotations. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded annotation and
 * internal newlines stay intact.
 */
export function canonicalDailyBriefBoardEffectiveRecommendedAction(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Brief Board
 * `finding.managerFeedback.effectiveRecommendedAction` display. Preserves soft
 * empty → null (intentional localized effectiveRecommendedAction.none copy)
 * while refusing to invent a clean annotation via Unicode em-space trim. Does
 * not throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live `|| t("dailyBrief.feedback.effectiveRecommendedAction.none")` branch
 * owns the fallback without inventing a clean Board annotation from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking annotation line through the prior
 * always-pass-effectiveRecommendedAction row.
 */
export function normalizeDailyBriefBoardEffectiveRecommendedAction(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the annotation Text instead of the
  // intentional localized effectiveRecommendedAction.none copy.
  // Do not invent a clean Daily Brief Board annotation from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalDailyBriefBoardEffectiveRecommendedAction(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded annotation on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
