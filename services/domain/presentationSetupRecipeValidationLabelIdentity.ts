/**
 * Setup recipe validation label identity helpers (MISE-005UK).
 *
 * Pins setup-screen `recipe.dishName.trim() || t("setup.validation.recipeLabel", …)`
 * validation-message prep outside the Expo UI graph so Node tests can exercise
 * inventing proofs without loading React Native. Prior recipe-step validation
 * Unicode-trimmed the draft dish name before embedding it in recipeName /
 * recipeIngredient / ingredientFields / ingredientRange messages
 * (`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`), so
 * NBSP/em-space padding invented a clean recipe identity rendered into setup
 * validation chrome. Soft empty / Unicode-only space also collapsed through
 * `.trim()` into the intentional i18n recipeLabel fallback.
 *
 * These are presentation **setup recipe validation labels** only — not setup
 * inventory validation labels (#974 / MISE-005UJ), not setup inventory-step
 * supplier ChoiceChip labels (#973 / MISE-005UI), not durable setup
 * `supplierNames` (#904 / MISE-005RR), not auth setup-screen supplier
 * identity (#696 / MISE-005KA), not setup supplier name/email client saves
 * (#680 / MISE-005JK), not setup inventory item names (#903 / MISE-005RQ),
 * not ingredient validation labels
 * (`ingredient.itemName.trim() || t("setup.validation.ingredientLabel")`),
 * not Create Task assignee chip labels (#963 / MISE-005TY), not Login email
 * chip labels (#971 / MISE-005UG), and not supplier draft line labels (#972 /
 * MISE-005UH). Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so padded dish names cannot invent a clean validation label; the live
 * `|| t("setup.validation.recipeLabel", …)` branch then preserves the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged.
 *
 * Complements open setup inventory validation tip #974 / MISE-005UJ (which
 * explicitly left recipe / ingredient validation labels alone) without
 * sharing that module or rewriting ingredient validation / inventory /
 * supplier paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized recipe validation label before it is
 * rendered into setup validation chrome.
 */
export function asciiTrimPresentationSetupRecipeValidationLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup recipe validation label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupRecipeValidationLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupRecipeValidationLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup recipe validation label candidate.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * i18n recipeLabel fallback) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback chain owns the
 * intentional recipeLabel copy without inventing a clean recipe identity
 * from padding.
 */
export function normalizePresentationSetupRecipeValidationLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n recipeLabel fallback. Do
  // not invent a validation label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupRecipeValidationLabel(value);
}

/**
 * Resolve setup recipe validation label under ASCII C.
 * Soft-null / empty leaves the intentional
 * `|| t("setup.validation.recipeLabel", …)` fallback to the caller.
 */
export function presentationSetupRecipeValidationLabel(
  dishName: string | null | undefined
): string | null {
  return normalizePresentationSetupRecipeValidationLabel(dishName);
}
