/**
 * Setup recipe ingredient quantity-per-sale assertBounded error label
 * identity helpers (MISE-005UP).
 *
 * Pins application-layer `validateSetupInput` presentation
 * `ingredient.itemName || "Recipe ingredient"` quantity-per-sale
 * assertBounded error labels outside the repository graph so Node tests can
 * exercise inventing proofs without loading Expo UI. Prior quantity-per-sale
 * labels embedded the raw draft recipe ingredient item name, so:
 *
 * - Unicode-only space (`'\u2003'`) is truthy and bypassed the intentional
 *   English `"Recipe ingredient"` fallback, embedding padding into
 *   `"… quantity per sale"` Error text; and
 * - em-space / NBSP-padded names (`'\u2003Roma Tomatoes\u2003'`) would invent
 *   a clean ingredient identity under Unicode `.trim()`. Soft-null refuse
 *   keeps those padded tokens from inventing a clean label or from embedding
 *   padding into assertBounded Errors.
 *
 * Soft empty / Unicode-only space / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| "Recipe ingredient"` branch preserves the
 * intentional English fallback. Ordinary ASCII whitespace still trims clean.
 * Case and accents are left unchanged.
 *
 * These are presentation **setup recipe ingredient quantity-per-sale
 * assertBounded error labels** only — not setup inventory quantity/par
 * assertBounded labels (#979 / MISE-005UO), not setup-screen ingredient
 * validation labels (#976 / MISE-005UL), not setup-screen recipe validation
 * labels (#975 / MISE-005UK), not durable setup recipe ingredient itemNames
 * (#901 / MISE-005RO), not setup recipe ingredient itemName saves
 * (#902 / MISE-005RP), not setup-drafts recipe ingredient itemNames
 * (#898 / MISE-005RL), not setup recipe ingredient quantity drafts
 * (#896 / MISE-005RJ), and not Recipes Settings quantity accessibility
 * (#918 / MISE-005SF).
 *
 * Complements open tip #979 / MISE-005UO (inventory quantity/par assertBounded
 * Error labels) without sharing that module. When landing with #979, drop
 * #979's assertion that recipe ingredient labels still use raw
 * `ingredient.itemName || "Recipe ingredient"`.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized recipe ingredient quantity-per-sale error
 * label before it is embedded in the thrown Error.
 */
export function asciiTrimPresentationSetupRecipeIngredientQuantityLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup recipe ingredient quantity-per-sale assertBounded
 * error label under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, or containing ASCII controls.
 */
export function canonicalizePresentationSetupRecipeIngredientQuantityLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupRecipeIngredientQuantityLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup recipe ingredient quantity-per-sale assertBounded
 * error label candidate. Preserves soft empty → null (including Unicode-only
 * space that previously bypassed `|| "Recipe ingredient"` because it is a
 * truthy string) while refusing to invent a clean label via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live fallback chain owns the intentional English copy without
 * inventing a clean ingredient identity from padding.
 */
export function normalizePresentationSetupRecipeIngredientQuantityLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior raw
  // `ingredient.itemName || "Recipe ingredient"` treated those as truthy and
  // embedded padding into quantity-per-sale Errors. Do not invent an error
  // label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupRecipeIngredientQuantityLabel(value);
}

/**
 * Resolve setup recipe ingredient quantity-per-sale assertBounded error label
 * under ASCII C. Soft-null / empty leaves the intentional
 * `|| "Recipe ingredient"` fallback to the caller.
 */
export function presentationSetupRecipeIngredientQuantityLabel(
  itemName: string | null | undefined
): string | null {
  return normalizePresentationSetupRecipeIngredientQuantityLabel(itemName);
}
