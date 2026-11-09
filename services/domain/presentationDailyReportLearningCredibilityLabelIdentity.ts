/**
 * Daily Report learning.credibilityLabel identity helpers (MISE-005AAR).
 *
 * Pins the Daily Report Learning & credibility blockLabel Text that previously
 * always rendered raw `learning.credibilityLabel` via:
 *   `{visibleReport.learning.credibilityLabel}`
 *
 * `buildDailyOpsReport` assigns
 * `credibilityLabel: summary.credibility.label`. That credibility label string
 * is always-passed into the Daily Report blockLabel. A Unicode-only-space
 * credibility label (`"\u2003"`) is non-empty and still rendered as the entire
 * blockLabel body, so blank-looking credibility identity appeared on Daily
 * Report learning rows with no intentional localized none marker. Empty string
 * has the same blank-body bypass. Separately, Unicode `.trim()` on a padded
 * credibility label (`"\u2003Credibility building\u2003".trim()`) invents by
 * stripping trailing Unicode padding before that string is rendered into the
 * Daily Report blockLabel Text (`"Credibility building"`).
 *
 * Single-line credibility-label tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an unpadded
 * credibility label. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.learning.credibilityLabel.none**
 * credibilityLabel tokens only — the Daily Report learning blockLabel Text
 * that falls through to that fallback when soft-null. Not Daily Report
 * learning credibilityNextStep (#1177 / MISE-005ZS), not memoryNextStep
 * (#1176 / MISE-005ZR), not memoryCopy (#1175 / MISE-005ZQ), not Daily Report
 * advice action.title (#1173) / action.detail (#1174), not askBriefingText
 * (#866), not Daily Report advice/credibility i18n (#258), and not Insights
 * How-Mise-knows memory nextStep (#1171) / operatorCopy (#1170). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyReport.learning.credibilityLabel.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1177 / #1176 / #1175 / #1174 / #1173 / #1171 / #1170 / #866 /
 * #258 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report learning credibility label
 * before it is rendered into the Learning & credibility blockLabel Text.
 */
export function asciiTrimDailyReportLearningCredibilityLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report learning.credibilityLabel under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportLearningCredibilityLabel(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportLearningCredibilityLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report learning `credibilityLabel`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.learning.credibilityLabel.none copy) while refusing to invent a
 * clean credibility label via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.learning.credibilityLabel.none")` branch owns the
 * fallback without inventing a clean Daily Report learning credibility label
 * from padding, and without letting Unicode-only space or empty string render
 * a blank-looking blockLabel body through the prior always-pass path.
 */
export function normalizeDailyReportLearningCredibilityLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered as the blockLabel body instead of the
  // intentional localized dailyReport.learning.credibilityLabel.none copy.
  // Do not invent a clean Daily Report learning credibility label from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportLearningCredibilityLabel(value);
}
