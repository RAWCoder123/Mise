/**
 * Setup ingredient validation label identity helpers (MISE-005UL).
 *
 * Pins setup-screen `ingredient.itemName.trim() || t("setup.validation.ingredientLabel", …)`
 * validation-message prep outside the Expo UI graph so Node tests can exercise
 * inventing proofs without loading React Native. Prior recipe-step validation
 * Unicode-trimmed the draft ingredient item name before embedding it in
 * ingredientFields / ingredientRange messages
 * (`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`), so NBSP/em-space
 * padding invented a clean ingredient identity rendered into setup validation
 * chrome. Soft empty / Unicode-only space also collapsed through `.trim()`
 * into the intentional i18n ingredientLabel fallback.
 *
 * These are presentation **setup ingredient validation labels** only — not
 * setup recipe validation labels (#975 / MISE-005UK), not setup inventory
 * validation labels (#974 / MISE-005UJ), not setup inventory-step supplier
 * ChoiceChip labels (#973 / MISE-005UI), not durable setup `supplierNames`
 * (#904 / MISE-005RR), not auth setup-screen supplier identity (#696 /
 * MISE-005KA), not setup supplier name/email client saves (#680 /
 * MISE-005JK), not setup inventory item names (#903 / MISE-005RQ), not
 * Create Task assignee chip labels (#963 / MISE-005TY), not Login email chip
 * labels (#971 / MISE-005UG), and not supplier draft line labels (#972 /
 * MISE-005UH). Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so padded ingredient names cannot invent a clean validation label; the live
 * `|| t("setup.validation.ingredientLabel", …)` branch then preserves the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged.
 *
 * Complements open setup recipe validation tip #975 / MISE-005UK (which
 * explicitly left ingredient validation labels alone) without sharing that
 * module or rewriting recipe / inventory / supplier paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized ingredient validation label before it is
 * rendered into setup validation chrome.
 */
export function asciiTrimPresentationSetupIngredientValidationLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup ingredient validation label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupIngredientValidationLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupIngredientValidationLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup ingredient validation label candidate.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * i18n ingredientLabel fallback) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback chain owns the
 * intentional ingredientLabel copy without inventing a clean ingredient
 * identity from padding.
 */
export function normalizePresentationSetupIngredientValidationLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n ingredientLabel fallback. Do
  // not invent a validation label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupIngredientValidationLabel(value);
}

/**
 * Resolve setup ingredient validation label under ASCII C.
 * Soft-null / empty leaves the intentional
 * `|| t("setup.validation.ingredientLabel", …)` fallback to the caller.
 */
export function presentationSetupIngredientValidationLabel(
  itemName: string | null | undefined
): string | null {
  return normalizePresentationSetupIngredientValidationLabel(itemName);
}
