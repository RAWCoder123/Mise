/**
 * Home StatusNotice low-stock itemName identity helpers (MISE-005ZT).
 *
 * Pins the Home restaurant-status `StatusNotice` title path that previously
 * always passed raw `primaryMenuRisk.itemName` into the low-stock title
 * interpolation when a menu-risk outlook row is present:
 *   `t("home.alert.lowStock.itemTitle", { item: primaryMenuRisk.itemName })`
 *
 * `buildOperatingOutlook` assigns `itemName: item.item_name` from the
 * restaurant inventory item. That free-form inventory name is always-passed
 * into the Home StatusNotice title whenever `brief.outlook.menuRisks[0]`
 * exists. A Unicode-only-space item name (`"\u2003"`) is non-nullish and still
 * rendered as the `{item}` slot, so blank-looking low-stock titles such as
 * `"Low stock: "` appeared on Home with no intentional localized none marker.
 * Empty string has the same blank-slot bypass. Separately, Unicode `.trim()` on
 * a padded item name (`"\u2003Chicken Breast\u2003".trim()`) invents by
 * stripping trailing Unicode padding before that string is interpolated into
 * the Home StatusNotice title (`"Chicken Breast"`).
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **home.alert.lowStock.itemName.none** item-name
 * tokens only — the Home StatusNotice low-stock `{item}` interpolation that
 * falls through to that fallback when soft-null. Not Home StatusNotice
 * restaurantStatus.topRisk (#1138 / MISE-005YF), not StatusNotice
 * restaurantStatus.summary (#1137 / MISE-005YE), not StatusNotice
 * whyItMatters (#1136 / MISE-005YD), not ApprovalsSection card.title
 * (#1049 / MISE-005WO) / recommendedAction (#1134) / whyItMatters (#1135),
 * not StatusNotice approval titles (#1011 / MISE-005VC), not Home greeting
 * restaurant.name (#1044 / MISE-005WJ), not Inventory hub item.item_name
 * (#1056 / MISE-005WV), and not Daily Report sales top-item itemName
 * (#1063 / MISE-005XC). Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| t("home.alert.lowStock.itemName.none")` branch
 * owns the intentional localized fallback. Ordinary ASCII whitespace still
 * trims clean. The `primaryMenuRisk` presence gate and the
 * `primaryApproval?.title || t(statusKey)` fallthrough are left unchanged.
 *
 * Complements open #1138 / #1137 / #1136 / #1135 / #1134 / #1049 / #1011 /
 * #1044 / #1056 / #1063 without sharing those modules or rewriting their
 * call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Home StatusNotice low-stock item name
 * before it is interpolated into home.alert.lowStock.itemTitle.
 */
export function asciiTrimHomeStatusLowStockItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Home StatusNotice low-stock item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeHomeStatusLowStockItemName(
  value: string
): string | null {
  const trimmed = asciiTrimHomeStatusLowStockItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home StatusNotice low-stock `primaryMenuRisk.itemName`.
 * Preserves soft empty → null (intentional localized
 * home.alert.lowStock.itemName.none copy) while refusing to invent a clean
 * item name via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("home.alert.lowStock.itemName.none")` branch owns the fallback without
 * inventing a clean Home StatusNotice low-stock item name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking `{item}` slot through the prior always-pass interpolation.
 */
export function normalizeHomeStatusLowStockItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into home.alert.lowStock.itemTitle as a
  // blank-looking item identity.
  // Do not invent a clean Home StatusNotice low-stock item name from padding.
  if (!value.trim()) return null;
  return canonicalizeHomeStatusLowStockItemName(value);
}
