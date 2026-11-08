/**
 * Daily Brief Board finding.freshness.missingData item identity helpers
 * (MISE-005ZV).
 *
 * Pins the Daily Brief Board missing-data Text that previously always joined
 * and rendered raw `finding.freshness.missingData` tokens:
 *   `t("dailyBrief.missingData", { items: finding.freshness.missingData.join(", ") })`
 *
 * Unmapped POS sales embed free-form menu item names into missingData via
 * `menu_mapping:${name}` in `operationalFindings.ts`, where `name` comes from
 * `boundedText(sale.item_name, ...)`. That helper Unicode-trims and collapses
 * whitespace before the Board always-passes the joined list into the Missing
 * line. A Unicode-padded menu item name
 * (`"\u2003Chicken Breast\u2003".trim()`) invents a clean missing-data token
 * (`menu_mapping:Chicken Breast`) before display. Separately, a
 * Unicode-only-space or control-bearing free-form token that reaches the Board
 * join remains non-nullish and still renders into the `{items}` slot, so
 * blank-looking Missing lines appeared with no intentional localized none
 * marker for the unsafe token.
 *
 * Single-line missing-data item tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded missing-data token. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because each token is
 * rendered as a single-line Missing-list entry.
 *
 * These are presentation **dailyBrief.missingData.item.none** missing-data
 * item tokens only — each Board `{items}` join entry that falls through to
 * that fallback when soft-null. Not Daily Brief Board finding.title
 * (#1145 / MISE-005YM), not finding.explanation (#1142 / MISE-005YJ), not
 * affectedWorkflow meta interpolation (deferred pending inventing beyond
 * controlled enums), not recommendedAction a11y (only finding.title is in
 * a11y today), not Phase Brief FindingRow interpretation (#1157) / title
 * (#1156), and not Daily Report signal.line (#1179 / MISE-005ZU). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.missingData.item.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean. Controlled
 * freshness tokens (`inventory_item`, `verified_physical_count`,
 * `menu_mapping`, `verified_canonical_unit`) remain durable when they are
 * already ASCII-safe.
 *
 * Complements open #1145 / #1142 / #1157 / #1156 / #1179 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Brief missing-data item before it is
 * joined into dailyBrief.missingData `{items}`.
 */
export function asciiTrimDailyBriefMissingDataItem(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Brief missing-data item under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDailyBriefMissingDataItem(
  value: string
): string | null {
  const trimmed = asciiTrimDailyBriefMissingDataItem(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Brief Board `finding.freshness.missingData[]`
 * entries before join. Preserves soft empty → null (intentional localized
 * dailyBrief.missingData.item.none copy) while refusing to invent a clean
 * missing-data item via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("dailyBrief.missingData.item.none")` branch owns the fallback without
 * inventing a clean Daily Brief missing-data item from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking `{items}` entry through the prior always-pass join.
 */
export function normalizeDailyBriefMissingDataItem(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into dailyBrief.missingData as a blank-looking
  // Missing-list entry.
  // Do not invent a clean Daily Brief missing-data item from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyBriefMissingDataItem(value);
}
