/**
 * Recipes baseline ingredient.itemName identity helpers (MISE-005XG).
 *
 * Pins Recipes Settings ingredient presentation that previously always
 * passed raw `ingredient.itemName` into the ingredient name Text and into
 * accessibility interpolations:
 * `{ingredient.itemName}`
 * `t("recipes.row.quantityAccessibility", { ingredient: ingredient.itemName })`
 * `t("recipes.row.readOnlyAccessibility", { ingredient: ingredient.itemName, ... })`
 * and `t("recipes.action.saveAccessibility", { ingredient: ingredient.itemName })`.
 *
 * A Unicode-only-space ingredient name (`"\u2003"`) is non-nullish and truthy
 * as a recipe field, so the Recipes ingredient chrome still rendered a
 * blank-looking ingredient identity with no intentional localized fallback.
 * Empty string has the same blank-looking ingredient path. Separately, Unicode
 * `.trim()` on a padded ingredient name
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean display ingredient identity if that gate Unicode-trimmed before
 * interpolating into the Recipes ingredient chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded ingredient name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **recipes.row.itemName.none** ingredient-name tokens
 * only — the Recipes Settings ingredient list `ingredient.itemName` that falls
 * through to that fallback when soft-null. Not Inventory hub item.item_name
 * (#1056 / MISE-005WV), not Inventory detail item_name (#1017 / MISE-005VI),
 * not RecommendationDecisionRow item_name (#1055 / MISE-005WU), not
 * Inventory count line.item_name (#1058), not Orders hub notice item_name
 * (#1057), not Daily Report waste.topItem itemName (#1064), not Log Delivery
 * history entry.itemName (#1062), not Scan Item row item.item_name (#1061),
 * not SupplierDraftCard line.itemName / #972, not recipe menu_item_name /
 * POS missing-recipe badge labels, not setup draft ingredient.itemName
 * validation trim, and not React list keys. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("recipes.row.itemName.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1066 / #1065 / #1064 / #1063 / #1062 / #1061 / #1060 /
 * #1059 / #1058 / #1057 / #1056 / #1055 / #1017 / #972 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Recipes ingredient name before it is
 * rendered into the ingredient name Text or a11y interpolations.
 */
export function asciiTrimRecipesIngredientItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Recipes ingredient name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesIngredientItemName(value: string): string | null {
  const trimmed = asciiTrimRecipesIngredientItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Recipes Settings `ingredient.itemName` display.
 * Preserves soft empty → null (intentional localized
 * recipes.row.itemName.none copy) while refusing to invent a clean
 * ingredient name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("recipes.row.itemName.none")` branch owns the fallback
 * without inventing a clean Recipes ingredient name from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking ingredient through the prior always-pass-name chrome.
 */
export function normalizeRecipesIngredientItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Recipes ingredient chrome as a
  // blank-looking ingredient identity.
  // Do not invent a clean Recipes ingredient name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesIngredientItemName(value);
}
