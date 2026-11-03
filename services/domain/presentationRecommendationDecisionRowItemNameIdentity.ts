/**
 * RecommendationDecisionRow recommendation.item_name identity helpers (MISE-005WU).
 *
 * Pins Orders review RecommendationDecisionRow presentation that previously
 * always passed raw `recommendation.item_name` into the itemName Text and into
 * accessibility interpolations:
 * `<Text style={styles.itemName}>{recommendation.item_name}</Text>`
 * and `t("orders.recommendation.*.Accessibility", { item: recommendation.item_name })`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy as a
 * recommendation field, so the Orders review row still rendered a blank-looking
 * item identity with no intentional localized fallback. Empty string has the
 * same blank-looking item path. Separately, Unicode `.trim()` on a padded item
 * name (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean display item identity if that gate Unicode-trimmed before interpolating
 * into the RecommendationDecisionRow chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **orders.recommendation.itemName.none** item-name
 * tokens only — the RecommendationDecisionRow `recommendation.item_name` that
 * falls through to that fallback when soft-null. Not Orders review
 * recommendation.supplier_name (#1051 / MISE-005WQ), not Inventory detail
 * item_name (#1017 / MISE-005VI), not Inventory detail supplier_name
 * (#1052 / MISE-005WR), not SupplierDraftCard order.supplier_name
 * (#1050 / MISE-005WP), not SupplierDraftCard line.itemName / #972, not
 * Orders hub notice `approved.item_name` interpolations, not purchase
 * recommendation reason free-text (#662), and not inventory hub list
 * `item.item_name` row titles. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("orders.recommendation.itemName.none")`
 * branch owns the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1054 / #1053 / #1052 / #1051 / #1050 / #1017 / #972
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized RecommendationDecisionRow item name
 * before it is rendered into the itemName Text or a11y interpolations.
 */
export function asciiTrimRecommendationDecisionRowItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a RecommendationDecisionRow item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecommendationDecisionRowItemName(
  value: string
): string | null {
  const trimmed = asciiTrimRecommendationDecisionRowItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for RecommendationDecisionRow `recommendation.item_name` display.
 * Preserves soft empty → null (intentional localized
 * orders.recommendation.itemName.none copy) while refusing to invent a clean
 * item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("orders.recommendation.itemName.none")` branch owns the fallback
 * without inventing a clean RecommendationDecisionRow item name from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * render a blank-looking item through the prior always-pass-name chrome.
 */
export function normalizeRecommendationDecisionRowItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the RecommendationDecisionRow as a
  // blank-looking item identity.
  // Do not invent a clean RecommendationDecisionRow item name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecommendationDecisionRowItemName(value);
}
