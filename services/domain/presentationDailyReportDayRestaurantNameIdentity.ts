/**
 * Daily Report closeout `day.restaurantName` identity helpers (MISE-005ABG).
 *
 * Pins the Daily Report closeout title that previously always rendered raw
 * `day.restaurantName` via:
 *   `<Text style={styles.closeoutTitle}>{visibleReport.day.restaurantName}</Text>`
 *
 * `buildDailyOpsReport` assigns `restaurantName` from the opaque free-string
 * restaurant name into `day.restaurantName`. That value is always-passed into
 * the closeout title Text. A Unicode-only-space restaurant name (`"\u2003"`) is
 * non-empty and still rendered as the entire closeout title, so blank-looking
 * restaurant identity appeared on Daily Report closeout with no intentional
 * localized none marker. Empty string has the same blank-title bypass.
 * Separately, Unicode `.trim()` on a padded restaurant name
 * (`"\u2003Harbor Kitchen\u2003".trim() === "Harbor Kitchen"`) invents by
 * stripping trailing Unicode padding before that string is rendered into the
 * closeout title Text.
 *
 * Single-line restaurant-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an unpadded
 * restaurant name. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.day.restaurantName.none** restaurant-name
 * tokens only — the Daily Report closeout title that falls through to that
 * fallback when soft-null. Not Daily Report Badge day.miseStatus (#1215 /
 * MISE-005ABD), not Ask Mise briefing.lead restaurant.name (#1211 /
 * MISE-005AAZ), not Ask Mise thinkingSteps restaurant.name (#1210), not Ask
 * Mise greeting.body restaurant.name (#1045), not Home / Autonomy / Today
 * restaurant-name tips, and not Daily Report operatingSummary / date Badge /
 * learning.credibilityLabel (#1203). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyReport.day.restaurantName.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1215 / #1211 / #1210 / #1045 / #1203 without sharing those
 * modules or rewriting their call sites. #1215 owns Daily Report Badge
 * `day.miseStatus` soft-null only and left Daily Report closeout
 * `day.restaurantName` alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report day.restaurantName before it is
 * rendered into the closeout title Text.
 */
export function asciiTrimDailyReportDayRestaurantName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report day.restaurantName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportDayRestaurantName(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportDayRestaurantName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report day `restaurantName`.
 * Preserves soft empty → null (intentional localized
 * dailyReport.day.restaurantName.none copy) while refusing to invent a clean
 * restaurant name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.day.restaurantName.none")` branch owns the fallback
 * without inventing a clean Daily Report closeout restaurant identity from
 * padding, and without letting Unicode-only space or empty string render a
 * blank-looking closeout title through the prior always-pass path.
 */
export function normalizeDailyReportDayRestaurantName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered as the closeout title instead of the intentional
  // localized dailyReport.day.restaurantName.none copy.
  // Do not invent a clean Daily Report day.restaurantName from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportDayRestaurantName(value);
}
