/**
 * Setup recipe dishName a11y identity helpers (MISE-005YA).
 *
 * Pins the Setup recipes-step accessibility / remove-label interpolations that
 * previously always passed raw `recipe.dishName` into:
 *   t("setup.remove.recipe", {
 *     recipe: recipe.dishName || t("setup.fallback.recipe")
 *   })
 *   t("setup.field.recipeIngredientAccessibility", {
 *     recipe: recipe.dishName || t("setup.fallback.recipe")
 *   })
 *   t("setup.addIngredientAccessibility", {
 *     recipe: recipe.dishName || t("setup.fallback.recipe")
 *   })
 *
 * A Unicode-only-space dish name (`"\u2003"`) is non-nullish and truthy, so the
 * intentional localized `setup.fallback.recipe` branch is bypassed and
 * VoiceOver / TalkBack labels can include blank-looking recipe identity with no
 * intentional localized fallback. Empty string already falls through via `||`,
 * but Unicode-only space does not. Separately, Unicode `.trim()` on a padded
 * dish name (`"\u2003Margherita Pizza\u2003".trim() === "Margherita Pizza"`)
 * would invent a clean recipe a11y token if that gate Unicode-trimmed before
 * interpolating into the remove / ingredient / add-ingredient accessibility
 * chrome.
 *
 * Single-line setup dish-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded dish name. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist) because this token is
 * interpolated into a single-line accessibility / remove label.
 *
 * These are presentation **setup.fallback.recipe** recipe tokens only — the
 * Setup remove / recipeIngredientAccessibility / addIngredientAccessibility
 * `recipe.dishName` template interpolations that fall through to that fallback
 * when soft-null. Not the TextInput `value={recipe.dishName}` editing surface,
 * not quantity/unit a11y `ingredient.itemName` (`setup.fallback.ingredient`,
 * open #1086 / MISE-005XZ), not open #862 / MISE-005QB validate/normalize
 * (`setupRecipeDishNameIdentity.ts`), not open #900 / MISE-005RN setup-drafts
 * dishName prep, not Recipes dish menu_item_name (#1080), and not setup draft
 * validation emptiness gates. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `|| t("setup.fallback.recipe")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #862 / #900 / #1086 / #1080 without sharing those modules or
 * rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Setup recipe dishName a11y token before it
 * is interpolated into the accessibility / remove label.
 */
export function asciiTrimSetupRecipeDishName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Setup recipe dishName a11y token under ASCII C. Returns null
 * when empty after ASCII trim, still Unicode-padded, or containing ASCII
 * controls.
 */
export function canonicalizeSetupRecipeDishName(value: string): string | null {
  const trimmed = asciiTrimSetupRecipeDishName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Setup recipe remove / a11y `recipe.dishName`. Preserves
 * soft empty → null (intentional localized setup.fallback.recipe copy) while
 * refusing to invent a clean dish name via Unicode em-space / NBSP trim. Does
 * not throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live `|| t("setup.fallback.recipe")` branch owns the fallback without
 * inventing a clean Setup recipe a11y token from padding, and without letting
 * truthy Unicode-only space bypass that intentional localized fallback through
 * the prior raw `||` path.
 */
export function normalizeSetupRecipeDishName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): truthy padding
  // previously still bypassed `|| t("setup.fallback.recipe")` instead of the
  // intentional localized recipe fallback copy.
  // Do not invent a clean Setup recipe dishName a11y token from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupRecipeDishName(value);
}
