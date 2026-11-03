/**
 * Log Delivery pick-list item.item_name identity helpers (MISE-005WY).
 *
 * Pins Log Delivery presentation that previously always passed raw
 * `item.item_name` into the pick-list OperationalRow title and accessibility
 * interpolations:
 * `title={item.item_name}`
 * and `t("logDelivery.row.accessibility", { item: item.item_name })`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy as an
 * inventory field, so the Log Delivery pick list still rendered a blank-looking
 * item identity with no intentional localized fallback. Empty string has the
 * same blank-looking item path. Separately, Unicode `.trim()` on a padded item
 * name (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean display item identity if that gate Unicode-trimmed before interpolating
 * into the Log Delivery row chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **logDelivery.row.itemName.none** item-name tokens
 * only — the Log Delivery pick-list `item.item_name` that falls through to that
 * fallback when soft-null. Not Scan Item row titles, not Log Delivery selected
 * StatusNotice / Screen subtitle `selected.item_name`, not history
 * `entry.itemName`, not Inventory hub item.item_name (#1056 / MISE-005WV), not
 * Inventory count line.item_name (#1058 / MISE-005WX), not Inventory detail
 * item_name (#1017 / MISE-005VI), not Inventory detail supplier_name
 * (#1052 / MISE-005WR), not RecommendationDecisionRow item_name
 * (#1055 / MISE-005WU), not Orders hub notice item_name (#1057 / MISE-005WW),
 * not SupplierDraftCard line.itemName / #972, and not Log Delivery
 * search/filter haystack matching. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("logDelivery.row.itemName.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1058 / #1057 / #1056 / #1055 / #1054 / #1053 / #1052 /
 * #1051 / #1050 / #1017 / #972 without sharing those modules or rewriting
 * their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Log Delivery item name before it is
 * rendered into the OperationalRow title or a11y interpolations.
 */
export function asciiTrimLogDeliveryItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Log Delivery pick-list item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeLogDeliveryItemName(value: string): string | null {
  const trimmed = asciiTrimLogDeliveryItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Log Delivery pick-list `item.item_name` display.
 * Preserves soft empty → null (intentional localized
 * logDelivery.row.itemName.none copy) while refusing to invent a clean
 * item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("logDelivery.row.itemName.none")` branch owns the fallback
 * without inventing a clean Log Delivery item name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking item through the prior always-pass-name chrome.
 */
export function normalizeLogDeliveryItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Log Delivery pick list as a blank-looking
  // item identity.
  // Do not invent a clean Log Delivery item name from padding.
  if (!value.trim()) return null;
  return canonicalizeLogDeliveryItemName(value);
}
