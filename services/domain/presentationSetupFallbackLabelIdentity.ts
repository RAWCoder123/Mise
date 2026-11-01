/**
 * Setup remove / accessibility fallback-label identity helpers (MISE-005VD).
 *
 * Pins auth setup-screen remove IconPress labels and related accessibility
 * interpolations that previously used raw truthiness before the intentional
 * localized fallback:
 * `item.name || t("setup.fallback.inventory")`,
 * `supplier.name || t("setup.fallback.supplier")`,
 * `recipe.dishName || t("setup.fallback.recipe")`,
 * `ingredient.itemName || t("setup.fallback.ingredient")`.
 *
 * A Unicode-only-space name (`"\u2003"`) is raw-truthy
 * (`Boolean("\u2003") === true`) while `.trim()` empties it, so the
 * intentional `setup.fallback.*` copy was bypassed and a11y chrome could
 * speak a blank-looking item/supplier/recipe/ingredient token. Separately,
 * Unicode `.trim()` on padded names (`"\u2003Tomato\u2003".trim() ===
 * "Tomato"`) would invent a clean display identity if those gates used
 * Unicode trim before interpolation.
 *
 * These are presentation **setup.fallback.*** accessibility / remove-label
 * tokens only — not durable setup inventory item names (#903 / MISE-005RQ),
 * not setup supplier ChoiceChip labels (#973 / MISE-005UI), not auth
 * setup-screen supplier identity (#696 / MISE-005KA), not durable
 * supplierNames (#904 / MISE-005RR), not inventory / recipe / ingredient
 * validation labels (`*.trim() || t("setup.validation.*Label")`), and not
 * demo inventoryItemNames / continueWithDemo paths. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("setup.fallback.*")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean. Case is left
 * unchanged.
 *
 * Complements open setup tips #903 / #973 / #696 / #904 / #974–#980 without
 * sharing those modules or rewriting validation / chip / durable-name
 * paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup fallback label before it is
 * interpolated into remove / accessibility chrome.
 */
export function asciiTrimPresentationSetupFallbackLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup.fallback.* display token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupFallbackLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupFallbackLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup.fallback.* label candidate.
 * Preserves soft empty → null (intentional localized setup.fallback.* copy)
 * while refusing to invent a clean label via Unicode em-space trim. Does
 * not throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live `|| t("setup.fallback.*")` branch owns the fallback without inventing
 * a clean remove / a11y identity from padding, and without letting raw
 * truthy Unicode-only space bypass that fallback.
 */
export function normalizePresentationSetupFallbackLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously bypassed the intentional localized setup.fallback.* copy.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupFallbackLabel(value);
}
