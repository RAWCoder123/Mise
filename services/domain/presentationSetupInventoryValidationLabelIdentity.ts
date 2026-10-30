/**
 * Setup inventory validation label identity helpers (MISE-005UJ).
 *
 * Pins setup-screen `item.name.trim() || t("setup.validation.inventoryLabel", …)`
 * validation-message prep outside the Expo UI graph so Node tests can exercise
 * inventing proofs without loading React Native. Prior inventory-step
 * validation Unicode-trimmed the draft inventory item name before embedding it
 * in needsName / needsQuantity / needsUnit / supplier / range messages
 * (`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`), so NBSP/em-space
 * padding invented a clean inventory identity rendered into setup validation
 * chrome. Soft empty / Unicode-only space also collapsed through `.trim()`
 * into the intentional i18n inventoryLabel fallback.
 *
 * These are presentation **setup inventory validation labels** only — not
 * setup inventory-step supplier ChoiceChip labels (#973 / MISE-005UI), not
 * durable setup `supplierNames` (#904 / MISE-005RR), not auth setup-screen
 * supplier identity (#696 / MISE-005KA), not setup supplier name/email client
 * saves (#680 / MISE-005JK), not setup inventory item names (#903 /
 * MISE-005RQ), not recipe / ingredient validation labels
 * (`recipe.dishName.trim() || t("setup.validation.recipeLabel")` /
 * `ingredient.itemName.trim() || t("setup.validation.ingredientLabel")`), not
 * Create Task assignee chip labels (#963 / MISE-005TY), not Login email chip
 * labels (#971 / MISE-005UG), and not supplier draft line labels (#972 /
 * MISE-005UH). Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so padded inventory names cannot invent a clean validation label; the live
 * `|| t("setup.validation.inventoryLabel", …)` branch then preserves the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged.
 *
 * Complements open setup supplier ChoiceChip tip #973 / MISE-005UI (which
 * explicitly left inventory validation labels alone) without sharing that
 * module or rewriting durable inventory-name / recipe / ingredient paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized inventory validation label before it is
 * rendered into setup validation chrome.
 */
export function asciiTrimPresentationSetupInventoryValidationLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory validation label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupInventoryValidationLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupInventoryValidationLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup inventory validation label candidate.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * i18n inventoryLabel fallback) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback chain owns the
 * intentional inventoryLabel copy without inventing a clean inventory
 * identity from padding.
 */
export function normalizePresentationSetupInventoryValidationLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n inventoryLabel fallback. Do
  // not invent a validation label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupInventoryValidationLabel(value);
}

/**
 * Resolve setup inventory validation label under ASCII C.
 * Soft-null / empty leaves the intentional
 * `|| t("setup.validation.inventoryLabel", …)` fallback to the caller.
 */
export function presentationSetupInventoryValidationLabel(
  name: string | null | undefined
): string | null {
  return normalizePresentationSetupInventoryValidationLabel(name);
}
