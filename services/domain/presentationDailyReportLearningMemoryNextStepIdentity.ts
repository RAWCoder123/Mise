/**
 * Daily Report learning.memoryNextStep identity helpers (MISE-005ZR).
 *
 * Pins the Daily Report Learning & credibility metaLine Text that previously
 * always rendered raw `learning.memoryNextStep` when non-nullish via:
 *   `{visibleReport.learning.memoryNextStep ?? visibleReport.learning.credibilityNextStep}`
 *
 * `buildDailyOpsReport` assigns
 * `memoryNextStep: learningMemory?.nextStep ?? null`. When a learning-memory
 * next step is present, that next-step copy is free-text from restaurant
 * learning evidence — the same untrusted source Insights How-Mise-knows tips
 * (#1171), but a distinct Daily Report closeout metaLine render surface. A
 * Unicode-only-space memory next step (`"\u2003"`) is non-nullish, so
 * `??` keeps it and blank-looking metaLine body appeared on Daily Report
 * learning rows with no intentional localized none marker. Empty string has
 * the same blank-body bypass when present. Separately, Unicode `.trim()` on a
 * padded memory next step
 * (`"\u2003Review the next Friday.\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the Daily Report metaLine Text
 * (`"Review the next Friday."`).
 *
 * Single-line learning-memory-next-step tips use ASCII end trim only and
 * preserve NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded memory next step. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.learning.memoryNextStep.none**
 * memoryNextStep tokens only — the Daily Report learning metaLine Text that
 * falls through to that fallback when soft-null and the raw field was present.
 * Not Daily Report learning memoryCopy (#1175), not credibilityNextStep (leave
 * alone — null raw memoryNextStep still falls through to raw
 * credibilityNextStep), not Daily Report advice action.title (#1173) /
 * action.detail (#1174), not askBriefingText (#866), not Insights
 * How-Mise-knows memory nextStep (#1171) / operatorCopy (#1170), and not Home
 * ApprovalsSection card.title (#1049). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyReport.learning.memoryNextStep.none")` branch owns the
 * intentional localized fallback when the raw field was present. Ordinary
 * ASCII whitespace still trims clean. Null raw memoryNextStep (no learning
 * memory next step) continues to fall through to credibilityNextStep.
 *
 * Complements open #1175 / #1174 / #1173 / #1171 / #1170 / #1049 / #866 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report learning memory next step
 * before it is rendered into the Learning & credibility metaLine Text.
 */
export function asciiTrimDailyReportLearningMemoryNextStep(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report learning.memoryNextStep under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportLearningMemoryNextStep(value: string): string | null {
  const trimmed = asciiTrimDailyReportLearningMemoryNextStep(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report learning `memoryNextStep`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.learning.memoryNextStep.none copy when the raw field was present)
 * while refusing to invent a clean learning memory next step via Unicode
 * em-space / NBSP trim. Does not throw; Unicode-padded / unsafe / non-string
 * tokens return null so the live
 * `|| t("dailyReport.learning.memoryNextStep.none")` branch owns the fallback
 * without inventing a clean Daily Report learning memory next step from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * render a blank-looking metaLine body through the prior
 * `memoryNextStep ?? credibilityNextStep` always-pass path.
 */
export function normalizeDailyReportLearningMemoryNextStep(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the metaLine body instead of the
  // intentional localized dailyReport.learning.memoryNextStep.none copy.
  // Do not invent a clean Daily Report learning memory next step from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportLearningMemoryNextStep(value);
}
