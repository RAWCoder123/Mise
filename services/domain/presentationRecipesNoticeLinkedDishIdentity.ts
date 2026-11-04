/**
 * Recipes Settings recipes.notice.linked dish draft identity helpers
 * (MISE-005XU).
 *
 * Pins the Settings → Recipes add-link success notice that previously always
 * passed the Unicode-trimmed draft dish name into:
 * `const menuItemName = newMenuItemName.trim();`
 * `setNotice(t("recipes.notice.linked", { ingredient: ..., dish: menuItemName }))`.
 *
 * Unicode `.trim()` on a padded draft dish name invents a clean display dish
 * identity before the notice interpolates it
 * (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`). Soft-null from the
 * raw `newMenuItemName` draft (not the already-trimmed API gate value) so
 * padding cannot invent equality with an unpadded dish name in the notice.
 * Empty / Unicode-only-space drafts soft-null rather than rendering a
 * blank-looking dish token when the gate somehow still reaches the notice.
 *
 * Single-line dish-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space). Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * interpolated into a single-line StatusNotice.
 *
 * These are presentation **recipes.notice.linked.dish.none** tokens only —
 * the add-link notice dish interpolation from the draft field. Not the
 * Settings Recipes recipeName Text / recipes.notice.confirmed path
 * (#1080 / MISE-005XT), not recipes.notice.linked ingredient tokens
 * (companion module in this tip), not setup recipe dish names (#862), not
 * inventory recipe-mapping menuItemName (#863), not demo baseline (#905), not
 * recipe-authority hydrate (#935), not POS missing-recipe badge labels, and
 * not the addRecipeBaselineIngredient write path that still uses
 * `newMenuItemName.trim()` for validation. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("recipes.notice.linked.dish.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1080 / #1067 / #935 / #905 / #863 / #862 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized linked-notice dish name before it is
 * interpolated into recipes.notice.linked.
 */
export function asciiTrimRecipesNoticeLinkedDishName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipes.notice.linked dish draft name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesNoticeLinkedDishName(value: string): string | null {
  const trimmed = asciiTrimRecipesNoticeLinkedDishName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for recipes.notice.linked raw `newMenuItemName` draft.
 * Preserves soft empty → null (intentional localized
 * recipes.notice.linked.dish.none copy) while refusing to invent a clean dish
 * name via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("recipes.notice.linked.dish.none")` branch owns the fallback without
 * inventing a clean linked-notice dish from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking dish
 * through the prior always-pass-trimmed-name notice.
 */
export function normalizeRecipesNoticeLinkedDishName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously could still reach the notice after gate churn as a
  // blank-looking dish identity.
  // Do not invent a clean linked-notice dish name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesNoticeLinkedDishName(value);
}
