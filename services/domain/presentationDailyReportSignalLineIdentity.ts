/**
 * Daily Report signalsByType signal.line identity helpers (MISE-005ZU).
 *
 * Pins the Daily Report closeout signal-row Text that previously always
 * rendered raw `signal.line`:
 *   `<Text style={styles.signalLine}>{signal.line}</Text>`
 *
 * `pickSignalLine` in `dailyOpsReport.ts` builds each signal line from free-form
 * insight fields (`recommended_action`, `why_it_matters`, `description`,
 * `title`). When an insight is present, that composed / fallback line is
 * always-passed into the Daily Report signal Text. A Unicode-only-space
 * insight description (`"\u2003"`) remains non-nullish on the
 * `why || best.description || best.title` fallthrough after trimmed action /
 * why slots empty out, so blank-looking signal lines appeared on Daily Report
 * closeout with no intentional localized none marker. Empty string has the
 * same blank-body bypass. Separately, Unicode `.trim()` on padded insight
 * action / why fields (`"\u2003Review waste before closeout\u2003".trim()`)
 * invents a clean signal line before that string is rendered into the Daily
 * Report signal Text (`"Review waste before closeout"`).
 *
 * Single-line signal-line tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded signal line. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist) because this token is rendered as
 * a single-line signal body.
 *
 * These are presentation **dailyReport.signal.line.none** signal-line tokens
 * only — the Daily Report `{signal.line}` that falls through to that fallback
 * when soft-null. Not Daily Report advice action.title (#1173 / MISE-005ZO),
 * not advice action.detail (#1174 / MISE-005ZP), not askBriefingText
 * (#866 / MISE-005QF), not learning memoryCopy / memoryNextStep /
 * credibilityNextStep (#1175 / #1176 / #1177), not learning credibilityLabel
 * (coordinate with open #258), not Insights signal presentation.detail /
 * label / value (#1166 / #1167 / #1168), and not Daily Brief Board
 * affectedWorkflow / missingData. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyReport.signal.line.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean. Empty
 * closeout placeholder localization (`No {type} signal for closeout.`) remains
 * owned by open #258 and is left untouched in domain.
 *
 * Complements open #866 / #1166 / #1167 / #1168 / #1173 / #1174 / #1175 /
 * #1176 / #1177 / #258 without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report signal line before it is
 * rendered into the signalLine Text.
 */
export function asciiTrimDailyReportSignalLine(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report signal.line under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportSignalLine(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportSignalLine(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report `signalsByType[].line` display.
 * Preserves soft empty → null (intentional localized
 * dailyReport.signal.line.none copy) while refusing to invent a clean signal
 * line via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.signal.line.none")` branch owns the fallback without
 * inventing a clean Daily Report signal line from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking signalLine through the prior always-pass Text.
 */
export function normalizeDailyReportSignalLine(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the signalLine Text instead of the
  // intentional localized dailyReport.signal.line.none copy.
  // Do not invent a clean Daily Report signal line from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportSignalLine(value);
}
