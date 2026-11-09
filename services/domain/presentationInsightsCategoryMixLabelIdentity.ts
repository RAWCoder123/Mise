/**
 * Insights analytics categoryMix slice.label identity helpers (MISE-005AAT).
 *
 * Pins Insights presentation that previously always passed free-form
 * `slice.label` into category-mix DonutChart legend chrome via:
 *   localizeMixLabel(slice.label, t) → DonutChart `{slice.label}`
 *
 * `buildInsightsSalesAnalytics` builds categoryMix labels from
 * `normalizeLabel(sale.category) || "Uncategorized"`. On main, Unicode `.trim()` /
 * `\s` collapse in that aggregation path can invent clean category identity
 * before the label reaches display (#869 tips aggregation separately). The
 * live SalesAnalyticsBoard categorySlices mapper still always-passes the
 * resulting free-form label through `localizeMixLabel` (except exact
 * "Other" / "Uncategorized" tokens) into DonutChart legend Text. A
 * Unicode-only-space category label (`"\u2003"`) is non-empty and still
 * rendered as blank-looking category identity in the legend with no
 * intentional localized none marker. Empty string has the same blank-body
 * bypass. Separately, Unicode `.trim()` on a padded category label
 * (`"\u2003Mains\u2003".trim() === "Mains"`) invents a clean display
 * category identity if that gate Unicode-trimmed before rendering into
 * Insights category-mix legend chrome.
 *
 * Single-line category-mix label tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded category label. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.analytics.categoryMix.label.none**
 * category-mix label tokens only — the Insights category-mix DonutChart
 * legend label that falls through to that fallback when soft-null. Not
 * Insights sales aggregation labels (#869 / MISE-005QI), not Insights
 * best-sellers itemName display (#1196 / MISE-005AAK), not Insights
 * sourceMix slice labels (#1204 / MISE-005AAS), not Daily Report
 * deliveries.line.unit (#1195), not providerSaleIdentity client normalize
 * (#673), and not Insights profile / subtitle restaurant or cuisine tips
 * (#969 / #970 / #1029 / #1037). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("insights.analytics.categoryMix.label.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #869 / #1196 / #1204 / #673 / #969 / #970 / #1029 / #1037
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights category-mix label before it is
 * rendered into DonutChart legend chrome.
 */
export function asciiTrimInsightsCategoryMixLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights categoryMix slice.label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsCategoryMixLabel(
  value: string
): string | null {
  const trimmed = asciiTrimInsightsCategoryMixLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights analytics categoryMix `slice.label` display.
 * Preserves soft empty → null (intentional localized
 * insights.analytics.categoryMix.label.none copy) while refusing to invent a
 * clean category label via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.analytics.categoryMix.label.none")` branch owns the
 * fallback without inventing a clean Insights category-mix label from
 * padding, and without letting Unicode-only space or empty string render
 * a blank-looking DonutChart legend body through the prior always-pass
 * localizeMixLabel path.
 */
export function normalizeInsightsCategoryMixLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered as the DonutChart legend label instead of the
  // intentional localized insights.analytics.categoryMix.label.none copy.
  // Do not invent a clean Insights category-mix label from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsCategoryMixLabel(value);
}
