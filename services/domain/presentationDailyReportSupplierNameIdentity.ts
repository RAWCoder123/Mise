/**
 * Daily report supplier reliability supplierName identity helpers (MISE-005WS).
 *
 * Pins the daily-report supplier reliability row label that previously always
 * passed reliability-summary `supplier.supplierName` into the signalType Text:
 * `<Text style={styles.signalType}>{supplier.supplierName}</Text>`.
 *
 * Upstream `buildSupplierReliabilitySummary` previously invented a clean
 * supplier display identity via Unicode `.trim()` when seeding the
 * accumulator (`supplierName: order.supplier_name.trim()`). A padded order
 * supplier name (`"\u2003Sysco\u2003".trim() === "Sysco"`) therefore reached
 * the daily-report row as an invented clean label. Separately, empty string
 * and Unicode-only-space supplier names (after trim, or when passed through)
 * rendered blank-looking supplier identity on the reliability row with no
 * intentional localized fallback.
 *
 * Single-line supplier-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyReport.supplierReliability.supplierName.none**
 * supplier-name tokens only — the daily-report reliability row
 * `supplier.supplierName` that falls through to that fallback when soft-null.
 * Not Inventory detail subtitle item.supplier_name (#1052 / MISE-005WR), not
 * Orders review recommendation.supplier_name (#1051 / MISE-005WQ), not
 * SupplierDraftCard order.supplier_name (#1050 / MISE-005WP), not Orders
 * detail title supplier_name (#1016 / MISE-005VH), not miseDomain draft-order
 * supplier_name (#1034 / MISE-005VZ), not Settings suppliers
 * `entry.supplierName`. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live
 * `|| t("dailyReport.supplierReliability.supplierName.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1052 / #1051 / #1050 / #1034 / #1016 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized daily-report supplier name before it is
 * rendered into the reliability row signalType Text.
 */
export function asciiTrimDailyReportSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a daily-report supplier reliability supplier name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyReportSupplierName(
  value: string
): string | null {
  const trimmed = asciiTrimDailyReportSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for daily-report reliability `supplier.supplierName` display
 * and for the reliability accumulator seed that previously Unicode-trimmed
 * `order.supplier_name`. Preserves soft empty → null (intentional localized
 * dailyReport.supplierReliability.supplierName.none copy) while refusing to
 * invent a clean supplier name via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyReport.supplierReliability.supplierName.none")` branch owns the
 * fallback without inventing a clean daily-report supplier name from padding,
 * and without letting non-nullish Unicode-only space or empty string render a
 * blank-looking supplier through the prior always-pass-name row.
 */
export function normalizeDailyReportSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the daily-report reliability row as a
  // blank-looking supplier identity.
  // Do not invent a clean daily-report supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyReportSupplierName(value);
}
