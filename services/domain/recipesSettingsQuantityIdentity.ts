/**
 * Recipes-settings recipe-baseline quantity draft helpers (MISE-005SF).
 *
 * Pins `app/settings/recipes.tsx` quantity draft prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path fed Unicode-trimmed drafts into locale `parseNumber`
 * (`parseLocalizedNumber` → `input.trim()`), so NBSP / em-space padding
 * invented a clean baseline quantity
 * (`'\u200312\u2003'.trim() === '12'`) before
 * `requireRecipeBaselineQuantity` and durable recipe-baseline writes
 * (`updateRecipeBaselineIngredient` / `addRecipeBaselineIngredient`).
 * Unicode-only space also invented the empty / quantity-error branch via
 * `'\u2003'.trim() === ''` → `parseNumber` null → quantity error.
 *
 * These are single-line recipe quantity-used-per-sale drafts on Settings
 * Recipes only — not recipes-settings **name** identity (open #689 /
 * MISE-005JT), not setup recipe ingredient quantity drafts (#896 /
 * MISE-005RJ), not setup-drafts recipe ingredient quantities (#897 /
 * MISE-005RK), not Orders recommendation quantities (#889 / MISE-005RC),
 * and not inventory count / detail / Log Delivery quantity tips. Soft empty
 * (ASCII whitespace or Unicode-only space) stays `empty` so callers keep the
 * prior quantity-error contract. Ordinary ASCII whitespace still trims clean
 * before locale `parseNumber`. Unicode-padded or control-bearing drafts fail
 * closed as `invalid` so padded `"12"` cannot invent a saved baseline
 * quantity.
 *
 * Complements open recipes-settings name tip #689 / MISE-005JT without
 * sharing that module. Locale parsing stays on the screen via `parseNumber`;
 * this module only refuses to invent a clean draft string.
 */

export type RecipesSettingsQuantityPrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized quantity draft before baseline save.
 */
export function asciiTrimRecipesSettingsQuantityText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Recipes-settings quantity draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for locale `parseNumber`.
 */
export function canonicalizeRecipesSettingsQuantityText(
  value: string
): RecipesSettingsQuantityPrep {
  const trimmed = asciiTrimRecipesSettingsQuantityText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for Settings Recipes baseline quantity save / dirty parse.
 * Preserves soft empty → `empty` (prior emptiness → quantity error) while
 * refusing to invent a clean draft via Unicode em-space / NBSP trim.
 * Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareRecipesSettingsQuantityText(
  value: unknown
): RecipesSettingsQuantityPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the quantity-error branch via parseNumber null.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeRecipesSettingsQuantityText(value);
}
