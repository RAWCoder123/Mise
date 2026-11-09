/**
 * Daily Report closeout `day.operatingSummary` identity helpers (MISE-005ABH).
 *
 * Pins the Daily Report closeout summaryCopy Text that previously always
 * rendered raw `day.operatingSummary` via:
 *   `<Text style={styles.summaryCopy}>{visibleReport.day.operatingSummary}</Text>`
 *
 * `buildDailyOpsReport` assigns `operatingSummary` from the opaque free-string
 * `summary.operatingSummary` into `day.operatingSummary`. That value is
 * always-passed into the closeout summaryCopy Text. A Unicode-only-space
 * operating summary (`"\u2003"`) is non-empty and still rendered as the entire
 * closeout summary body, so blank-looking summary copy appeared on Daily
 * Report closeout with no intentional localized none marker. Empty string has
 * the same blank-body bypass. Separately, Unicode `.trim()` on a padded
 * operating summary
 * (`"\u2003Two items need attention before tomorrow.\u2003".trim() ===
 * "Two items need attention before tomorrow."`) invents by stripping trailing
 * Unicode padding before that string is rendered into the summaryCopy Text.
 *
 * Operating-summary tips are multiline free-text (parity with operator_note /
 * Orders detail deliveryEvidence notes #1208 / MISE-005AAW): fold NBSP to a
 * plain space, then trim only C-locale `[[:space:]]` from the ends. Do not
 * collapse internal whitespace with `\s` or Unicode `String#trim`, so internal
 * LF/TAB/CR survive and em-space padding cannot invent equality with an
 * unpadded summary. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks a free-form operating summary may carry.
 *
 * These are presentation **dailyReport.day.operatingSummary.none**
 * operating-summary tokens only — the Daily Report closeout summaryCopy that
 * falls through to that fallback when soft-null. Not Daily Report closeout
 * day.restaurantName (#1218 / MISE-005ABG), not Daily Report Badge
 * day.miseStatus (#1215 / MISE-005ABD), not Daily Report signal.line (#1179 /
 * MISE-005ZU), not advice action.detail (#1174 / MISE-005ZP), not learning
 * memoryCopy (#1175 / MISE-005ZQ), not Ask Mise briefing.lead status (#1214),
 * and not the operatingSummary attention-template i18n (#257). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyReport.day.operatingSummary.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1218 / #1215 / #1179 / #1174 / #1175 / #1214 / #257 without
 * sharing those modules or rewriting their call sites. #1218 owns Daily Report
 * closeout `day.restaurantName` soft-null only and left Daily Report closeout
 * `day.operatingSummary` alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for Daily Report day.operatingSummary.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean summary body and
 * internal newlines stay intact.
 */
export function asciiPrepDailyReportDayOperatingSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a Daily Report day.operatingSummary under ASCII C multiline
 * prep. Returns null when empty after prep, still Unicode-padded, or containing
 * disallowed controls.
 */
export function canonicalizeDailyReportDayOperatingSummary(
  value: string
): string | null {
  const prepared = asciiPrepDailyReportDayOperatingSummary(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize for Daily Report day `operatingSummary`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.day.operatingSummary.none copy) while refusing to invent a clean
 * operating summary via Unicode em-space trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.day.operatingSummary.none")` branch owns the fallback
 * without inventing a clean Daily Report closeout operating-summary identity
 * from padding, and without letting Unicode-only space or empty string render
 * a blank-looking summaryCopy through the prior always-pass path.
 */
export function normalizeDailyReportDayOperatingSummary(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered as the summaryCopy Text instead of the
  // intentional localized dailyReport.day.operatingSummary.none copy.
  // Do not invent a clean Daily Report day.operatingSummary from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportDayOperatingSummary(value);
}
