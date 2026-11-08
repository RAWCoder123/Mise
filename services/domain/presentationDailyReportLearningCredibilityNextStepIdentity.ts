/**
 * Daily Report learning.credibilityNextStep identity helpers (MISE-005ZS).
 *
 * Pins the Daily Report Learning & credibility metaLine Text that previously
 * always rendered raw `learning.credibilityNextStep` when `memoryNextStep`
 * was nullish via:
 *   `{visibleReport.learning.memoryNextStep ?? visibleReport.learning.credibilityNextStep}`
 *
 * `buildDailyOpsReport` assigns
 * `credibilityNextStep: summary.credibility.nextStep`. When no learning-memory
 * next step is present, that credibility next-step string is always-passed
 * into the Daily Report metaLine. A Unicode-only-space credibility next step
 * (`"\u2003"`) is non-nullish and still rendered as the entire metaLine body,
 * so blank-looking credibility next-step copy appeared on Daily Report
 * learning rows with no intentional localized none marker. Empty string has
 * the same blank-body bypass. Separately, Unicode `.trim()` on a padded
 * credibility next step
 * (`"\u2003Keep reviewing outcomes.\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the Daily Report metaLine Text
 * (`"Keep reviewing outcomes."`).
 *
 * Single-line credibility-next-step tips use ASCII end trim only and
 * preserve NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded credibility next step. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.learning.credibilityNextStep.none**
 * credibilityNextStep tokens only — the Daily Report learning metaLine Text
 * that falls through to that fallback when soft-null on the
 * null-memoryNextStep path. Not Daily Report learning memoryNextStep (#1176),
 * not memoryCopy (#1175), not Daily Report advice action.title (#1173) /
 * action.detail (#1174), not askBriefingText (#866), not Insights
 * How-Mise-knows memory nextStep (#1171) / operatorCopy (#1170), and not Home
 * ApprovalsSection card.title (#1049). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyReport.learning.credibilityNextStep.none")` branch owns the
 * intentional localized fallback when the null-memoryNextStep fallthrough
 * owns the metaLine. Ordinary ASCII whitespace still trims clean. Non-null
 * raw memoryNextStep continues to pass through unchanged (leave #1176 alone).
 *
 * Complements open #1176 / #1175 / #1174 / #1173 / #1171 / #1170 / #1049 / #866
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report learning credibility next step
 * before it is rendered into the Learning & credibility metaLine Text.
 */
export function asciiTrimDailyReportLearningCredibilityNextStep(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report learning.credibilityNextStep under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportLearningCredibilityNextStep(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportLearningCredibilityNextStep(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report learning `credibilityNextStep`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.learning.credibilityNextStep.none copy on the
 * null-memoryNextStep fallthrough) while refusing to invent a clean
 * credibility next step via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.learning.credibilityNextStep.none")` branch owns the
 * fallback without inventing a clean Daily Report learning credibility next
 * step from padding, and without letting non-nullish Unicode-only space or
 * empty string render a blank-looking metaLine body through the prior
 * `memoryNextStep ?? credibilityNextStep` always-pass fallthrough.
 */
export function normalizeDailyReportLearningCredibilityNextStep(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the metaLine body instead of the
  // intentional localized dailyReport.learning.credibilityNextStep.none copy.
  // Do not invent a clean Daily Report learning credibility next step from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportLearningCredibilityNextStep(value);
}
