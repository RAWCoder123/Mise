/**
 * Orders hub notice / undo toast item_name identity helpers (MISE-005WW).
 *
 * Pins Orders hub presentation that previously always passed raw
 * recommendation `item_name` into StatusNotice and undo-toast interpolations:
 * `t("orders.notice.approved", { item: approved.item_name })`
 * `t("orders.notice.dismissed", { item: dismissed.item_name })`
 * `t("orders.notice.undoRestored", { item: restored.item_name })`
 * and undo toast / a11y `{ item: visibleUndoAction.recommendation.item_name }`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy as a
 * recommendation field, so the Orders hub still interpolated a blank-looking
 * item identity with no intentional localized fallback. Empty string has the
 * same blank-looking item path. Separately, Unicode `.trim()` on a padded item
 * name (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean display item identity if that gate Unicode-trimmed before interpolating
 * into the Orders hub notice / undo chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.notice.itemName.none** item-name tokens
 * only — the Orders hub notice / undo `item_name` that falls through to that
 * fallback when soft-null. Not RecommendationDecisionRow item_name
 * (#1055 / MISE-005WU), not Inventory hub item.item_name (#1056 / MISE-005WV),
 * not Inventory detail item_name (#1017 / MISE-005VI), not Inventory detail
 * supplier_name (#1052 / MISE-005WR), not Orders review
 * recommendation.supplier_name (#1051 / MISE-005WQ), not SupplierDraftCard
 * order.supplier_name (#1050 / MISE-005WP), not SupplierDraftCard line.itemName
 * / #972, not inventory count `line.item_name`, and not
 * `orders.notice.copied` supplier interpolations. Soft empty / Unicode-padded
 * / control-bearing tokens soft-null so the live
 * `|| t("orders.notice.itemName.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1056 / #1055 / #1054 / #1053 / #1052 / #1051 / #1050 /
 * #1017 / #972 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Orders hub notice item name before it is
 * interpolated into StatusNotice or undo-toast copy.
 */
export function asciiTrimOrdersHubNoticeItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Orders hub notice item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOrdersHubNoticeItemName(value: string): string | null {
  const trimmed = asciiTrimOrdersHubNoticeItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Orders hub notice / undo `item_name` display.
 * Preserves soft empty → null (intentional localized
 * orders.notice.itemName.none copy) while refusing to invent a clean
 * item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("orders.notice.itemName.none")` branch owns the fallback
 * without inventing a clean Orders hub notice item name from padding, and
 * without letting non-nullish Unicode-only space or empty string interpolate
 * a blank-looking item through the prior always-pass-name chrome.
 */
export function normalizeOrdersHubNoticeItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into Orders hub notices as a blank-looking
  // item identity.
  // Do not invent a clean Orders hub notice item name from padding.
  if (!value.trim()) return null;
  return canonicalizeOrdersHubNoticeItemName(value);
}
