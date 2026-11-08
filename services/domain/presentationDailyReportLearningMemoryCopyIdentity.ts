/**
 * Daily Report learning.memoryCopy identity helpers (MISE-005ZQ).
 *
 * Pins the Daily Report Learning & credibility summaryCopy Text that previously
 * truthy-gated and always rendered raw `learning.memoryCopy`:
 *   `{visibleReport.learning.memoryCopy ? (
 *      <Text style={styles.summaryCopy}>{visibleReport.learning.memoryCopy}</Text>
 *    ) : null}`
 *
 * `buildDailyOpsReport` assigns
 * `memoryCopy: learningMemory?.operatorCopy ?? null`. When a learning-memory
 * summary is present, that operator copy is free-text from restaurant learning
 * evidence — the same untrusted source Insights How-Mise-knows tips (#1170),
 * but a distinct Daily Report closeout render surface. A Unicode-only-space
 * memory copy (`"\u2003"`) is non-nullish and truthy, so blank-looking
 * summaryCopy body appeared on Daily Report learning rows with no intentional
 * localized none marker. Empty string has the same blank-body bypass when
 * present. Separately, Unicode `.trim()` on a padded memory copy
 * (`"\u2003Friday dinner demand is usually higher.\u2003".trim()`)
 * invents by stripping trailing Unicode padding before that string is
 * rendered into the Daily Report summaryCopy Text
 * (`"Friday dinner demand is usually higher."`).
 *
 * Single-line learning-memory-copy tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded memory copy. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.learning.memoryCopy.none** memoryCopy
 * tokens only — the Daily Report learning summaryCopy Text that falls through
 * to that fallback when soft-null and the raw field was present. Not Daily
 * Report learning memoryNextStep / credibilityNextStep, not Daily Report
 * advice action.title (#1173) / action.detail (#1174), not askBriefingText
 * (#866), not Insights How-Mise-knows memory operatorCopy (#1170) / nextStep
 * (#1171), and not Home ApprovalsSection card.title (#1049). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyReport.learning.memoryCopy.none")` branch owns the intentional
 * localized fallback when the raw field was present. Ordinary ASCII
 * whitespace still trims clean. Null raw memoryCopy (no learning memory)
 * continues to omit the Text entirely.
 *
 * Complements open #1174 / #1173 / #1171 / #1170 / #1049 / #866 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report learning memory copy before it
 * is rendered into the Learning & credibility summaryCopy Text.
 */
export function asciiTrimDailyReportLearningMemoryCopy(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report learning.memoryCopy under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportLearningMemoryCopy(value: string): string | null {
  const trimmed = asciiTrimDailyReportLearningMemoryCopy(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report learning `memoryCopy`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.learning.memoryCopy.none copy when the raw field was present)
 * while refusing to invent a clean learning memory copy via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("dailyReport.learning.memoryCopy.none")`
 * branch owns the fallback without inventing a clean Daily Report learning
 * memory copy from padding, and without letting non-nullish Unicode-only
 * space or empty string render a blank-looking summaryCopy body through the
 * prior truthy-gated always-pass-memoryCopy Text.
 */
export function normalizeDailyReportLearningMemoryCopy(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the summaryCopy body instead of the
  // intentional localized dailyReport.learning.memoryCopy.none copy.
  // Do not invent a clean Daily Report learning memory copy from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportLearningMemoryCopy(value);
}
