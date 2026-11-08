/**
 * Daily Report managerAdvice action.detail identity helpers (MISE-005ZP).
 *
 * Pins the Daily Report advice-row detail Text that previously always rendered
 * raw `action.detail`:
 *   `<Text style={styles.summaryCopy}>{action.detail}</Text>`
 *
 * Ranked advice actions can carry untrusted details from attention cards
 * (`card.detail`) and urgent insights
 * (`urgentInsight.recommended_action || urgentInsight.description`). A
 * Unicode-only-space advice detail (`"\u2003"`) is non-nullish and still
 * rendered as the entire summaryCopy line, so blank-looking advice detail
 * appeared on Daily Report closeout advice rows with no intentional
 * localized none marker. Empty string has the same blank-body bypass.
 * Separately, Unicode `.trim()` on a padded advice detail
 * (`"\u2003Review critical coverage\u2003".trim() === "Review critical coverage"`)
 * would invent a clean advice detail if that gate Unicode-trimmed before
 * rendering into the Daily Report summaryCopy Text.
 *
 * Single-line advice-detail tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded advice detail. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * rendered as a single-line advice detail.
 *
 * These are presentation **dailyReport.advice.actionDetail.none** advice-detail
 * tokens only — the Daily Report advice-row `{action.detail}` that falls
 * through to that fallback when soft-null. Not Daily Report
 * `{action.title}` (#1173 / MISE-005ZO), not Daily Ops askBriefingText
 * (#866 / MISE-005QF), not Daily Report learning memoryCopy /
 * memoryNextStep, not Home ApprovalsSection card.title (#1049 / MISE-005WO),
 * not Home ApprovalsSection recommendedAction (#1134 / MISE-005YB), not
 * How-Mise-knows memory operatorCopy / nextStep (#1170 / #1171), and not
 * Insights signal detail tips (#1166). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyReport.advice.actionDetail.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #866 / #1049 / #1134 / #1166 / #1170 / #1171 / #1173 /
 * #258 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report advice action detail before it
 * is rendered into the summaryCopy Text.
 */
export function asciiTrimDailyReportAdviceActionDetail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report advice action detail under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportAdviceActionDetail(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportAdviceActionDetail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report managerAdvice `action.detail` display.
 * Preserves soft empty → null (intentional localized
 * dailyReport.advice.actionDetail.none copy) while refusing to invent a clean
 * advice detail via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.advice.actionDetail.none")` branch owns the fallback
 * without inventing a clean Daily Report advice detail from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking summaryCopy through the prior always-pass-detail Text.
 */
export function normalizeDailyReportAdviceActionDetail(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the summaryCopy Text instead of the
  // intentional localized dailyReport.advice.actionDetail.none copy.
  // Do not invent a clean Daily Report advice action detail from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportAdviceActionDetail(value);
}
