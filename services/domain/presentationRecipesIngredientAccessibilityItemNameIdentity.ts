/**
 * Settings Recipes quantity/save/readOnly a11y ingredient.itemName identity
 * helpers (MISE-005ABQ).
 *
 * Pins the Settings Recipes accessibility interpolations that previously
 * always passed raw `ingredient.itemName` into a11y tokens:
 * `t("recipes.row.quantityAccessibility", { ingredient: ingredient.itemName })`
 * `t("recipes.row.readOnlyAccessibility", { ingredient: ingredient.itemName, ... })`
 * and `t("recipes.action.saveAccessibility", { ingredient: ingredient.itemName })`.
 *
 * A Unicode-only-space ingredient name (`"\u2003"`) is non-nullish and truthy,
 * so VoiceOver / TalkBack labels could include blank-looking ingredient
 * identity with no intentional localized none marker. Empty string has the
 * same always-pass blank-looking path. Separately, Unicode `.trim()` on a
 * padded ingredient name
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean ingredient identity if that gate Unicode-trimmed before interpolating
 * into the Settings Recipes a11y chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded ingredient name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **recipes.row.accessibility.ingredient.none**
 * ingredient-name tokens only — the Settings Recipes quantity / save /
 * readOnly a11y `ingredient` interpolations that fall through to that
 * fallback when soft-null. Not Settings Recipes ingredient name Text display
 * (#1067 / MISE-005XG), not Settings Recipes ingredient.unit (#1220 /
 * MISE-005ABI), not Setup recipe ingredient.itemName a11y (#1086 /
 * MISE-005XZ), not Recipes POS missing-recipe badge itemName (#1082), not
 * Recipes dish menu_item_name (#1080), not Recipes builder inventory
 * SuggestionChip (#1083), and not Inventory hub / detail item_name display
 * tips. Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * the live `|| t("recipes.row.accessibility.ingredient.none")` branch owns
 * the intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1067 / #1220 / #1086 / #1082 / #1080 / #1083 without
 * sharing those modules or rewriting their call sites. Distinct module from
 * #1067's Recipes ingredient display identity helpers so this a11y-only tip
 * can land independently of the display tip that also touches a11y.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Settings Recipes a11y ingredient name
 * before it is interpolated into quantity / save / readOnly accessibility
 * labels.
 */
export function asciiTrimRecipesIngredientAccessibilityItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings Recipes a11y ingredient.itemName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesIngredientAccessibilityItemName(
  value: string
): string | null {
  const trimmed = asciiTrimRecipesIngredientAccessibilityItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings Recipes a11y `ingredient.itemName`.
 * Preserves soft empty → null (intentional localized
 * recipes.row.accessibility.ingredient.none copy) while refusing to invent a
 * clean ingredient name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("recipes.row.accessibility.ingredient.none")` branch owns the
 * fallback without inventing a clean Settings Recipes a11y name from
 * padding, and without letting non-nullish Unicode-only space or empty
 * string interpolate a blank-looking ingredient through the prior
 * always-pass path.
 */
export function normalizeRecipesIngredientAccessibilityItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into quantity / save / readOnly a11y
  // instead of the intentional localized accessibility.ingredient.none copy.
  // Do not invent a clean Settings Recipes a11y ingredient name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesIngredientAccessibilityItemName(value);
}
