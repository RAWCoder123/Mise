/**
 * Recipes Settings recipes.notice.linked ingredient identity helpers
 * (MISE-005XU).
 *
 * Pins the Settings → Recipes add-link success notice that previously always
 * passed raw `selectedInventoryItem.item_name` into:
 * `setNotice(t("recipes.notice.linked", { ingredient: selectedInventoryItem.item_name, dish: menuItemName }))`.
 *
 * A Unicode-only-space inventory item name (`"\u2003"`) is non-nullish and
 * truthy as an InventoryItem field, so the linked notice still interpolated a
 * blank-looking ingredient identity with no intentional localized fallback.
 * Empty string has the same blank-looking ingredient path. Separately, Unicode
 * `.trim()` on a padded inventory item name
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean display ingredient identity if that gate Unicode-trimmed before
 * interpolating into the linked notice.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded ingredient name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * interpolated into a single-line StatusNotice.
 *
 * These are presentation **recipes.notice.linked.ingredient.none** tokens
 * only — the add-link notice ingredient interpolation. Not Recipes
 * ingredient.itemName row chrome (#1067 / MISE-005XG), not recipes.notice.linked
 * dish draft tokens (companion module in this tip), not recipes.notice.confirmed /
 * recipeName dish (#1080 / MISE-005XT), not Inventory hub item.item_name
 * (#1056), not Inventory detail item_name (#1017), not recipe-baseline
 * inventory itemName (#1035), not setup draft ingredient names, and not React
 * list keys. Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("recipes.notice.linked.ingredient.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1080 / #1067 / #1056 / #1035 / #1017 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized linked-notice ingredient name before it is
 * interpolated into recipes.notice.linked.
 */
export function asciiTrimRecipesNoticeLinkedIngredientName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipes.notice.linked ingredient name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesNoticeLinkedIngredientName(value: string): string | null {
  const trimmed = asciiTrimRecipesNoticeLinkedIngredientName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for recipes.notice.linked `selectedInventoryItem.item_name`.
 * Preserves soft empty → null (intentional localized
 * recipes.notice.linked.ingredient.none copy) while refusing to invent a clean
 * ingredient name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("recipes.notice.linked.ingredient.none")` branch owns the fallback
 * without inventing a clean linked-notice ingredient from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking ingredient through the prior always-pass-name notice.
 */
export function normalizeRecipesNoticeLinkedIngredientName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into recipes.notice.linked as a
  // blank-looking ingredient identity.
  // Do not invent a clean linked-notice ingredient name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesNoticeLinkedIngredientName(value);
}
