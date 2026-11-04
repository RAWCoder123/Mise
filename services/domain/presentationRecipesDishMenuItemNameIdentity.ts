/**
 * Recipes Settings dish menu_item_name identity helpers (MISE-005XT).
 *
 * Pins Settings → Recipes dish presentation that previously always passed raw
 * `item.menu_item_name` into the recipeName Text and into the confirm notice:
 * `<Text style={styles.recipeName}>{item.menu_item_name}</Text>`
 * and `setNotice(t("recipes.notice.confirmed", { item: item.menu_item_name }))`.
 *
 * A Unicode-only-space dish name (`"\u2003"`) is non-nullish and truthy as a
 * RecipeBaselineItem field, so the Recipes row still rendered a blank-looking
 * dish identity with no intentional localized fallback, and the confirm notice
 * could interpolate the same blank-looking token. Empty string has the same
 * blank-looking dish path. Separately, Unicode `.trim()` on a padded dish name
 * (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`) would invent a clean
 * display dish identity if that gate Unicode-trimmed before interpolating into
 * the Recipes Settings chrome.
 *
 * Single-line dish-name tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end padding
 * (NBSP / em-space) so padding cannot invent equality with an unpadded dish
 * name. Accents and case are preserved. Full C0/DEL control rejection applies
 * (no LF/TAB/CR allowlist) because this token is interpolated into a
 * single-line recipeName Text and a single-line notice.
 *
 * These are presentation **recipes.row.menuItemName.none** dish-name tokens
 * only — the Settings Recipes `item.menu_item_name` that falls through to that
 * fallback when soft-null. Not Recipes ingredient.itemName (#1067 / MISE-005XG),
 * not recipes.notice.linked ingredient/dish draft tokens, not setup recipe dish
 * names (#862 / MISE-005QB), not inventory recipe-mapping menuItemName
 * (#863 / MISE-005QC), not demo recipe-baseline menuItemName (#905 / MISE-005RS),
 * not recipe-authority hydrate menuItemName (#935 / MISE-005SW), not
 * recipe-baseline inventory itemName (#1035 / MISE-005WA), and not POS
 * missing-recipe badge labels. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("recipes.row.menuItemName.none")` branch
 * owns the intentional localized fallback. Ordinary ASCII whitespace still
 * trims clean.
 *
 * Complements open #1067 / #1035 / #935 / #905 / #863 / #862 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Recipes dish menu item name before it is
 * rendered into the recipeName Text or the confirm notice.
 */
export function asciiTrimRecipesDishMenuItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Recipes Settings dish menu item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesDishMenuItemName(value: string): string | null {
  const trimmed = asciiTrimRecipesDishMenuItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings Recipes `item.menu_item_name` display / notice.
 * Preserves soft empty → null (intentional localized
 * recipes.row.menuItemName.none copy) while refusing to invent a clean dish
 * name via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("recipes.row.menuItemName.none")` branch owns the fallback without
 * inventing a clean Recipes dish menu item name from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking dish through the prior always-pass-name chrome.
 */
export function normalizeRecipesDishMenuItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the Recipes dish name Text / confirm notice
  // as a blank-looking dish identity.
  // Do not invent a clean Recipes dish menu item name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesDishMenuItemName(value);
}
