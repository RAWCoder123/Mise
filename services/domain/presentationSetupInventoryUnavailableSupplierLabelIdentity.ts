/**
 * Setup inventory unavailable-supplier error label identity helpers (MISE-005UX).
 *
 * Pins application-layer `saveRestaurantSetup` presentation
 * `${itemName} references an unavailable supplier.` error-message prep outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Expo UI. Prior save-path validation Unicode-trimmed the draft
 * inventory item name into `itemName` before embedding it in the thrown Error
 * (`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`), so NBSP/em-space
 * padding invented a clean inventory identity rendered into the error.
 *
 * These are presentation **setup inventory unavailable-supplier error labels**
 * only — not setup inventory supplier-required error labels
 * (#977 / MISE-005UM), not setup-screen inventory validation labels
 * (#974 / MISE-005UJ), not durable setup inventory item names
 * (#903 / MISE-005RQ), not setup inventory-name keys (#679 / MISE-005JJ), not
 * quantity/par assertBounded labels (#979 / MISE-005UO), not recipe /
 * ingredient validation labels (#975 / #976), and not setup supplier
 * ChoiceChip labels (#973). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so padded inventory names cannot invent a clean error
 * label; the live `|| "Inventory item"` branch then preserves the intentional
 * English fallback. Ordinary ASCII whitespace still trims clean. Case and
 * accents are left unchanged.
 *
 * Complements open setup inventory supplier-required tip #977 / MISE-005UM
 * (validateSetupInput path) without sharing that module or rewriting durable
 * `draft.name.trim()` / inventory-name key paths owned by #679.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized inventory unavailable-supplier error label
 * before it is embedded in the thrown Error.
 */
export function asciiTrimPresentationSetupInventoryUnavailableSupplierLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory unavailable-supplier error label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupInventoryUnavailableSupplierLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupInventoryUnavailableSupplierLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup inventory unavailable-supplier error label candidate.
 * Preserves soft empty → null (prior emptiness `continue` skipped the throw;
 * intentional English `"Inventory item"` fallback owns padded presentation)
 * while refusing to invent a clean label via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * fallback chain owns the intentional English copy without inventing a clean
 * inventory identity from padding.
 */
export function normalizePresentationSetupInventoryUnavailableSupplierLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the skip/`continue` branch. Do not invent an error
  // label from padding when the unavailable-supplier path still throws.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupInventoryUnavailableSupplierLabel(value);
}

/**
 * Resolve setup inventory unavailable-supplier error label under ASCII C.
 * Soft-null / empty leaves the intentional `|| "Inventory item"` fallback to
 * the caller.
 */
export function presentationSetupInventoryUnavailableSupplierLabel(
  name: string | null | undefined
): string | null {
  return normalizePresentationSetupInventoryUnavailableSupplierLabel(name);
}
