/**
 * Inventory detail add-action a11y item_name identity helpers (MISE-005XJ).
 *
 * Pins the Inventory detail "Add to Order" accessibility interpolation that
 * previously always passed raw `item.item_name` into the item token:
 * `t("inventory.detail.addAccessibility", { item: item.item_name })`
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking item identity with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded item name
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean item identity if that gate Unicode-trimmed before interpolating into
 * the add-action a11y chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **inventory.detail.add.item.none** item tokens only
 * — the addAccessibility a11y `item` interpolation that falls through to that
 * fallback when soft-null. Not Inventory detail Screen title item_name
 * (#1017 / MISE-005VI), not Inventory hub item.item_name (#1056), not
 * Inventory detail supplier_name (#1052), not Inventory count line.item_name
 * (#1058), not Recipes ingredient.itemName (#1067), not waste itemName
 * (#1018), and not recommendation / orders item_name tips. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("inventory.detail.add.item.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1017 (which explicitly left this add-action a11y path
 * alone) without sharing that Screen-title module or rewriting its call site.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Inventory detail add-action a11y item name
 * before it is interpolated into the accessibility label.
 */
export function asciiTrimInventoryDetailAddAccessibilityItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Inventory detail add-action a11y item_name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryDetailAddAccessibilityItemName(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryDetailAddAccessibilityItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Inventory detail add-action a11y `item.item_name`.
 * Preserves soft empty → null (intentional localized add.item.none copy)
 * while refusing to invent a clean item name via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("inventory.detail.add.item.none")` branch owns the
 * fallback without inventing a clean add-action a11y item from padding, and
 * without letting non-nullish Unicode-only space or empty string interpolate
 * a blank-looking item through the prior always-pass path.
 */
export function normalizeInventoryDetailAddAccessibilityItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into addAccessibility a11y instead of the
  // intentional localized add.item.none copy.
  // Do not invent a clean Inventory detail add-action a11y item from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryDetailAddAccessibilityItemName(value);
}
