/**
 * Setup recipe ingredient a11y itemName identity helpers (MISE-005XZ).
 *
 * Pins the Setup recipes-step accessibility interpolations that previously
 * always passed raw `ingredient.itemName` into:
 *   t("setup.field.quantityAccessibility", {
 *     ingredient: ingredient.itemName || t("setup.fallback.ingredient")
 *   })
 *   t("setup.field.unitAccessibility", {
 *     ingredient: ingredient.itemName || t("setup.fallback.ingredient")
 *   })
 *
 * A Unicode-only-space ingredient name (`"\u2003"`) is non-nullish and truthy,
 * so the intentional localized `setup.fallback.ingredient` branch is bypassed
 * and VoiceOver / TalkBack labels can include blank-looking ingredient identity
 * with no intentional localized fallback. Empty string already falls through
 * via `||`, but Unicode-only space does not. Separately, Unicode `.trim()` on a
 * padded ingredient name
 * (`"\u2003Olive oil\u2003".trim() === "Olive oil"`) would invent a clean
 * ingredient a11y token if that gate Unicode-trimmed before interpolating into
 * the quantity / unit accessibility chrome.
 *
 * Single-line setup ingredient-name tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded ingredient name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * interpolated into a single-line accessibility label.
 *
 * These are presentation **setup.fallback.ingredient** ingredient tokens only —
 * the Setup quantity / unit a11y `ingredient.itemName` template interpolations
 * that fall through to that fallback when soft-null. Not the TextInput
 * `value={ingredient.itemName}` editing surface, not `recipe.dishName` a11y
 * (`setup.fallback.recipe`), not Recipes ingredient.itemName (#1067), not
 * Recipes builder inventory SuggestionChip item.item_name (#1083), not
 * Inventory hub item.item_name (#1056), not setup draft validation
 * `ingredient.itemName.trim()` emptiness gates, and not setup unit emptiness
 * gates. Soft empty / Unicode-padded / control-bearing tokens soft-null so the
 * live `|| t("setup.fallback.ingredient")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1067 / #1083 / #1056 and open #901 / MISE-005RO
 * (`setupRecipeIngredientItemNameIdentity.ts` validate/normalize path) without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Setup recipe ingredient a11y name before it
 * is interpolated into the accessibility label.
 */
export function asciiTrimSetupRecipeIngredientItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Setup recipe ingredient a11y itemName under ASCII C. Returns
 * null when empty after ASCII trim, still Unicode-padded, or containing ASCII
 * controls.
 */
export function canonicalizeSetupRecipeIngredientItemName(
  value: string
): string | null {
  const trimmed = asciiTrimSetupRecipeIngredientItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Setup recipe quantity / unit a11y `ingredient.itemName`.
 * Preserves soft empty → null (intentional localized setup.fallback.ingredient
 * copy) while refusing to invent a clean ingredient name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t("setup.fallback.ingredient")` branch owns the
 * fallback without inventing a clean Setup ingredient a11y token from padding,
 * and without letting truthy Unicode-only space bypass that intentional
 * localized fallback through the prior raw `||` path.
 */
export function normalizeSetupRecipeIngredientItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): truthy padding
  // previously still bypassed `|| t("setup.fallback.ingredient")` instead of
  // the intentional localized ingredient fallback copy.
  // Do not invent a clean Setup recipe ingredient a11y name from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupRecipeIngredientItemName(value);
}
