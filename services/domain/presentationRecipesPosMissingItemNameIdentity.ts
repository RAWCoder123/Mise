/**
 * Recipes Settings POS missing-recipe badge itemName identity helpers
 * (MISE-005XV).
 *
 * Pins the Settings → Recipes warning badges and builder suggestion chips that
 * previously always passed raw `posItemsMissingRecipes` / `missingMenuItems`
 * entries into Badge / SuggestionChip labels:
 * `label={itemName}`
 *
 * A Unicode-only-space POS menu item name (`"\u2003"`) is non-nullish and
 * truthy as a sale.item_name field, so the missing-recipe warning list and
 * builder chips still rendered a blank-looking menu-item identity with no
 * intentional localized fallback. Empty string has the same blank-looking
 * path. Separately, Unicode `.trim()` on a padded menu item name
 * (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`) would invent a
 * clean display menu-item identity if that gate Unicode-trimmed before
 * interpolating into the missing-recipe badge chrome.
 *
 * Single-line menu-item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded menu item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * rendered into single-line Badge / SuggestionChip labels.
 *
 * These are presentation **recipes.warning.itemName.none** tokens only — the
 * POS missing-recipe badge / builder-missing chip labels that fall through to
 * that fallback when soft-null. Not recipes.notice.linked ingredient/dish
 * (#1081 / MISE-005XU), not Recipes dish menu_item_name / recipes.notice.confirmed
 * (#1080 / MISE-005XT), not Recipes ingredient.itemName row chrome
 * (#1067 / MISE-005XG), not recipe-baseline inventory itemName (#1035), not
 * Inventory hub item.item_name (#1056), not React list keys, not
 * SuggestionChip onPress write-back of the raw menu name, not the builder
 * active Unicode-trim equality gate, and not domain
 * `posItemsMissingRecipes` computation. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("recipes.warning.itemName.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1081 / #1080 / #1067 / #1056 / #1035 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS missing-recipe badge menu item name
 * before it is rendered into Badge / SuggestionChip labels.
 */
export function asciiTrimRecipesPosMissingItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS missing-recipe badge menu item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesPosMissingItemName(value: string): string | null {
  const trimmed = asciiTrimRecipesPosMissingItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Recipes POS missing-recipe badge / builder-missing chip
 * `itemName` display. Preserves soft empty → null (intentional localized
 * recipes.warning.itemName.none copy) while refusing to invent a clean menu
 * item name via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("recipes.warning.itemName.none")` branch owns the fallback without
 * inventing a clean missing-recipe badge label from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking menu item through the prior always-pass-name chrome.
 */
export function normalizeRecipesPosMissingItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into POS missing-recipe badges as a
  // blank-looking menu-item identity.
  // Do not invent a clean POS missing-recipe badge menu item name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesPosMissingItemName(value);
}
