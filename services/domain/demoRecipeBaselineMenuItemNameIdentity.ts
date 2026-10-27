/**
 * Demo recipe-baseline menuItemName helpers (MISE-005RS).
 *
 * Pins `services/demo/replaceableDemoData.ts` `parseRecipeLine` menu-item
 * prep outside the React Native screen graph so Node tests can exercise
 * inventing proofs without loading Expo. The prior path fed the left-hand
 * side of each recipe-baseline line through `menuItemName.trim()` into
 * durable demo `menu_item_name` mappings via `applyRecipeBaselineText` /
 * `applyDemoSetupProfile`, which Unicode-trim before durable use
 * (`'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`), so NBSP /
 * em-space padding invented a clean dish name the operator did not type as
 * ordinary ASCII text. Unicode-only space also invented an empty
 * `menu_item_name` via `'\u2003'.trim() === ''`.
 *
 * These are replaceable-demo **recipe-baseline menuItemName** drafts only —
 * not setup-drafts recipe dishName tokens (open #900 / MISE-005RN), not
 * application/setup recipe dish names (open #862 / MISE-005QB), not
 * replaceableDemo setup-list / lookup keys (open #686 / MISE-005JQ), not
 * ingredient itemName / unit / entry trim inside the same parser, and not
 * free-form notes. Soft empty (ASCII whitespace or Unicode-only space)
 * stays `empty` so callers keep the prior empty-after-trim skip contract.
 * Ordinary ASCII whitespace still trims clean before durable
 * menu_item_name. Unicode-padded or control-bearing drafts fail closed as
 * `invalid` so padded `"Chicken Bowl"` cannot invent a dish name.
 *
 * Complements open setup-drafts dish tip #900 / MISE-005RN and setup-list
 * tip #686 / MISE-005JQ without sharing those modules. Leave ingredient
 * `itemName` / `unit` / comma-entry bare `trim()`, line soft-empty
 * `recipeBaselineText?.trim()`, and setupDrafts `recipe.dishName.trim()`
 * alone until their own tips own those paths.
 */

export type DemoRecipeBaselineMenuItemNamePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized demo recipe-baseline menu item name
 * before durable menu_item_name mappings.
 */
export function asciiTrimDemoRecipeBaselineMenuItemNameText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a demo recipe-baseline menu item name under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for durable menu_item_name.
 */
export function canonicalizeDemoRecipeBaselineMenuItemNameText(
  value: string
): DemoRecipeBaselineMenuItemNamePrep {
  const trimmed = asciiTrimDemoRecipeBaselineMenuItemNameText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for demo recipe-baseline menuItemName parse / durable map.
 * Preserves soft empty → `empty` (prior `menuItemName.trim()` empty path)
 * while refusing to invent a clean draft via Unicode em-space / NBSP trim.
 * Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareDemoRecipeBaselineMenuItemNameText(
  value: unknown
): DemoRecipeBaselineMenuItemNamePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `menuItemName.trim()` emptied those into an empty durable name.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeDemoRecipeBaselineMenuItemNameText(value);
}
