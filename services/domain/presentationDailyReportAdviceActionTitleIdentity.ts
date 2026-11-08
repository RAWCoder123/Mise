/**
 * Daily Report managerAdvice action.title identity helpers (MISE-005ZO).
 *
 * Pins the Daily Report advice-row title Text that previously always rendered
 * raw `action.title`:
 *   `<Text style={styles.adviceTitle}>{action.title}</Text>`
 *
 * Ranked advice actions can carry untrusted titles from attention cards
 * (`card.title`) and urgent insights (`urgentInsight.title`). A
 * Unicode-only-space advice title (`"\u2003"`) is non-nullish and still
 * rendered as the entire adviceTitle line, so blank-looking advice identity
 * appeared on Daily Report closeout advice rows with no intentional
 * localized none marker. Empty string has the same blank-body bypass.
 * Separately, Unicode `.trim()` on a padded advice title
 * (`"\u2003Review chicken coverage\u2003".trim() === "Review chicken coverage"`)
 * would invent a clean advice title if that gate Unicode-trimmed before
 * rendering into the Daily Report adviceTitle Text.
 *
 * Single-line advice-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded advice title. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * rendered as a single-line advice title.
 *
 * These are presentation **dailyReport.advice.actionTitle.none** advice-title
 * tokens only — the Daily Report advice-row `{action.title}` that falls
 * through to that fallback when soft-null. Not Daily Report
 * `{action.detail}`, not Daily Ops askBriefingText (#866 / MISE-005QF), not
 * Daily Report learning memoryCopy / memoryNextStep, not Home
 * ApprovalsSection card.title (#1049 / MISE-005WO), not Home ApprovalsSection
 * recommendedAction (#1134 / MISE-005YB), not How-Mise-knows memory
 * operatorCopy / nextStep (#1170 / #1171), and not Insights signal title
 * tips. Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("dailyReport.advice.actionTitle.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #866 / #1049 / #1134 / #1170 / #1171 / #258 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report advice action title before it
 * is rendered into the adviceTitle Text.
 */
export function asciiTrimDailyReportAdviceActionTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report advice action title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportAdviceActionTitle(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportAdviceActionTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report managerAdvice `action.title` display.
 * Preserves soft empty → null (intentional localized
 * dailyReport.advice.actionTitle.none copy) while refusing to invent a clean
 * advice title via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.advice.actionTitle.none")` branch owns the fallback
 * without inventing a clean Daily Report advice title from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking adviceTitle through the prior always-pass-title Text.
 */
export function normalizeDailyReportAdviceActionTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the adviceTitle Text instead of the
  // intentional localized dailyReport.advice.actionTitle.none copy.
  // Do not invent a clean Daily Report advice action title from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportAdviceActionTitle(value);
}
