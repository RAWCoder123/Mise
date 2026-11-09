/**
 * Daily Report Badge `day.miseStatus` identity helpers (MISE-005ABD).
 *
 * Pins the Daily Report closeout Badge that previously always rendered raw
 * `day.miseStatus` via:
 *   `<Badge label={visibleReport.day.miseStatus} tone="warning" />`
 *
 * `buildDailyOpsReport` assigns `miseStatus: summary.miseStatus`. That opaque
 * free-string status is always-passed into the closeout Badge label. A
 * Unicode-only-space status (`"\u2003"`) is non-empty and still rendered as the
 * entire Badge label, so blank-looking status identity appeared on Daily Report
 * closeout with no intentional localized none marker. Empty string has the same
 * blank-label bypass. Separately, Unicode `.trim()` on a padded status
 * (`"\u2003Watch\u2003".trim() === "Watch"`) invents by stripping trailing
 * Unicode padding before that string is rendered into the Badge label Text.
 *
 * Single-line miseStatus tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an unpadded
 * status. Accents and case are preserved. Full C0/DEL control rejection applies
 * (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.day.miseStatus.none** status tokens
 * only — the Daily Report closeout Badge label that falls through to that
 * fallback when soft-null. Not Ask Mise briefing.lead `{status}` (#1214 /
 * MISE-005ABC), not Ask Mise briefing.lead restaurant.name (#1211), not Daily
 * Report restaurantName / operatingSummary display, not the closeout date
 * Badge, not learning.credibilityLabel (#1203), and not Ask Mise /
 * Daily Report miseStatus i18n localization (#264 / #256). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyReport.day.miseStatus.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1214 / #1211 / #1203 / #264 / #256 without sharing those
 * modules or rewriting their call sites. #1214 owns Ask Mise briefing.lead
 * `{status}` soft-null only and left Daily Report Badge `day.miseStatus` alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report day.miseStatus before it is
 * rendered into the closeout Badge label.
 */
export function asciiTrimDailyReportDayMiseStatus(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report day.miseStatus under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportDayMiseStatus(value: string): string | null {
  const trimmed = asciiTrimDailyReportDayMiseStatus(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report day `miseStatus`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.day.miseStatus.none copy) while refusing to invent a clean
 * status via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.day.miseStatus.none")` branch owns the fallback without
 * inventing a clean Daily Report Badge status from padding, and without letting
 * Unicode-only space or empty string render a blank-looking Badge label through
 * the prior always-pass path.
 */
export function normalizeDailyReportDayMiseStatus(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered as the Badge label instead of the intentional
  // localized dailyReport.day.miseStatus.none copy.
  // Do not invent a clean Daily Report day.miseStatus from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportDayMiseStatus(value);
}
