/**
 * Daily Report sales top-item itemName identity helpers (MISE-005XC).
 *
 * Pins Daily Report presentation that previously always passed raw
 * `item.itemName` into the sales top-sellers line interpolation:
 * `t("dailyReport.sales.topItemLine", { item: item.itemName, ... })`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy as a
 * sales top-item field, so the top-sellers line still rendered a blank-looking
 * item identity with no intentional localized fallback. Empty string has the
 * same blank-looking item path. Separately, Unicode `.trim()` on a padded item
 * name (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean display item identity if that gate Unicode-trimmed before interpolating
 * into the sales top-item line.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.sales.topItem.itemName.none** item-name
 * tokens only — the Daily Report sales top-sellers `item.itemName` that falls
 * through to that fallback when soft-null. Not Daily Report waste.topItem
 * itemName, not Daily Report deliveries.line itemName, not waste.event.unknownItem
 * paths (#1018 / MISE-005VJ), not daily-report supplier.supplierName
 * (#1053 / MISE-005WS), not Log Delivery history entry.itemName
 * (#1062 / MISE-005XB), not Inventory hub item.item_name (#1056 / MISE-005WV),
 * not RecommendationDecisionRow item_name (#1055 / MISE-005WU), and not
 * SupplierDraftCard line.itemName / #972. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyReport.sales.topItem.itemName.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1062 / #1053 / #1018 / #1056 / #1055 / #972 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Report sales top-item name before it
 * is interpolated into the sales topItemLine.
 */
export function asciiTrimDailyReportSalesTopItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Report sales top-item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportSalesTopItemName(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportSalesTopItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Report sales top-sellers `item.itemName` display.
 * Preserves soft empty → null (intentional localized
 * dailyReport.sales.topItem.itemName.none copy) while refusing to invent a
 * clean item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.sales.topItem.itemName.none")` branch owns the fallback
 * without inventing a clean Daily Report sales top-item name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking item through the prior always-pass-name chrome.
 */
export function normalizeDailyReportSalesTopItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Daily Report sales topItemLine as a
  // blank-looking item identity.
  // Do not invent a clean Daily Report sales top-item name from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportSalesTopItemName(value);
}
