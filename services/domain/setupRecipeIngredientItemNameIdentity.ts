/**
 * Setup recipe ingredient itemName draft helpers (MISE-005RO).
 *
 * Pins `app/(auth)/setup.tsx` recipe ingredient `itemName` prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path fed those drafts into
 * `ingredient.itemName.trim()` emptiness / label gates and into
 * `normalizeRecipeDraftNumbers` → `saveRestaurantSetup` /
 * `recipeDraftsToBaselineText`, which Unicode-trim before durable use
 * (`'\u2003Tomato\u2003'.trim() === 'Tomato'`), so NBSP / em-space padding
 * invented a clean recipe ingredient item name the operator did not type as
 * ordinary ASCII text. Unicode-only space also invented the required-empty
 * branch via `'\u2003'.trim() === ''`.
 *
 * These are single-line setup recipe ingredient **itemName** drafts only —
 * not setup-drafts recipe ingredient itemName baseline tokens (open #898 /
 * MISE-005RL `setupDraftsRecipeIngredientItemNameIdentity.ts`), not setup.tsx
 * recipe ingredient quantity (open #896 / MISE-005RJ), not setup-drafts
 * quantity / unit / dishName (open #897 / #899 / #900), not application setup
 * recipe dishName (open #862 / MISE-005QB), not application
 * `ingredient.itemName.trim()` lookup (left alone), not setup inventory unit
 * (open #861 / MISE-005QA), and not free-form notes. Soft empty (ASCII
 * whitespace or Unicode-only space) stays `empty` so callers keep the prior
 * required-itemName emptiness contract. Ordinary ASCII whitespace still trims
 * clean before labels / normalize. Unicode-padded or control-bearing drafts
 * fail closed as `invalid` so padded `"Tomato"` cannot invent a recipe
 * ingredient item name.
 *
 * Complements open setup-drafts itemName tip #898 / MISE-005RL and setup
 * recipe ingredient quantity tip #896 / MISE-005RJ without sharing those
 * modules. Leave setup.tsx `ingredient.quantity.trim()` /
 * `ingredient.unit.trim()` and application `ingredient.itemName.trim()` alone.
 */

export type SetupRecipeIngredientItemNamePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup recipe ingredient item name before
 * validation labels and save normalize.
 */
export function asciiTrimSetupRecipeIngredientItemNameText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup recipe ingredient itemName draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for labels / normalize.
 */
export function canonicalizeSetupRecipeIngredientItemNameText(
  value: string
): SetupRecipeIngredientItemNamePrep {
  const trimmed = asciiTrimSetupRecipeIngredientItemNameText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for setup recipe ingredient itemName validate / normalize.
 * Preserves soft empty → `empty` (prior required `ingredient.itemName.trim()`
 * emptiness) while refusing to invent a clean draft via Unicode em-space /
 * NBSP trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareSetupRecipeIngredientItemNameText(
  value: unknown
): SetupRecipeIngredientItemNamePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `ingredient.itemName.trim()` emptied those into the required-empty branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeSetupRecipeIngredientItemNameText(value);
}
