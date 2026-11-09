/**
 * Insights analytics best-sellers itemName identity helpers (MISE-005AAK).
 *
 * Pins Insights presentation that previously always passed raw
 * `item.itemName` into the best-sellers seller-name chrome:
 * `{item.itemName}` inside the Insights sales analytics best-sellers list.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy as a
 * best-seller field, so Insights still rendered a blank-looking item identity
 * with no intentional localized fallback. Empty string has the same
 * blank-looking item path. Separately, Unicode `.trim()` on a padded item
 * name (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`)
 * would invent a clean display item identity if that gate Unicode-trimmed
 * before rendering into Insights best-sellers seller-name chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **insights.analytics.bestSellers.itemName.none**
 * item-name tokens only — the Insights best-sellers `item.itemName` that
 * falls through to that fallback when soft-null. Not Daily Report sales
 * top-sellers itemName (#1063 / MISE-005XC), not Daily Report waste.topItem
 * itemName (#1064 / MISE-005XD), not Daily Report deliveries.line itemName
 * (#1065 / MISE-005XE), not Ask Mise top-sale item names (#937 / MISE-005SY),
 * not Insights InsightListRow presentation.title (#1185 / MISE-005ZZ), not
 * Insights signal presentation labels (#1166–#1168), not Inventory hub
 * item.item_name (#1056 / MISE-005WV), and not RecommendationDecisionRow
 * item_name (#1055 / MISE-005WU). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("insights.analytics.bestSellers.itemName.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1063 / #1064 / #1065 / #937 / #1185 / #1166–#1168 /
 * #1056 / #1055 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Insights best-sellers item name before it
 * is rendered into seller-name chrome.
 */
export function asciiTrimInsightsBestSellersItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights best-sellers item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInsightsBestSellersItemName(
  value: string
): string | null {
  const trimmed = asciiTrimInsightsBestSellersItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights analytics best-sellers `item.itemName` display.
 * Preserves soft empty → null (intentional localized
 * insights.analytics.bestSellers.itemName.none copy) while refusing to invent
 * a clean item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.analytics.bestSellers.itemName.none")` branch owns the
 * fallback without inventing a clean Insights best-sellers item name from
 * padding, and without letting non-nullish Unicode-only space or empty
 * string render a blank-looking item through the prior always-pass-name
 * chrome.
 */
export function normalizeInsightsBestSellersItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Insights best-sellers seller-name chrome
  // as a blank-looking item identity.
  // Do not invent a clean Insights best-sellers item name from padding.
  if (!value.trim()) return null;
  return canonicalizeInsightsBestSellersItemName(value);
}
