/**
 * Setup inventory supplier-required error label identity helpers (MISE-005UM).
 *
 * Pins application-layer `validateSetupInput` presentation
 * `item.name.trim() || "Inventory item"` error-message prep outside the
 * repository graph so Node tests can exercise inventing proofs without
 * loading Expo UI. Prior supplier-required validation Unicode-trimmed the
 * draft inventory item name before embedding it in
 * `"… requires a configured supplier."`
 * (`'\u2003Roma Tomatoes\u2003'.trim() === 'Roma Tomatoes'`), so NBSP/em-space
 * padding invented a clean inventory identity rendered into the thrown Error.
 * Soft empty / Unicode-only space also collapsed through `.trim()` into the
 * intentional English `"Inventory item"` fallback.
 *
 * These are presentation **setup inventory supplier-required error labels**
 * only — not setup-screen inventory validation labels (#974 / MISE-005UJ),
 * not durable setup inventory item names (#903 / MISE-005RQ), not setup
 * inventory-name keys (#679 / MISE-005JJ), not recipe / ingredient validation
 * labels (#975 / #976), not setup supplier ChoiceChip labels (#973), not
 * durable setup `supplierNames` (#904), and not the save-path
 * `draft.name.trim()` durable `item_name` write (open #679). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so padded inventory
 * names cannot invent a clean error label; the live `|| "Inventory item"`
 * branch then preserves the intentional English fallback. Ordinary ASCII
 * whitespace still trims clean. Case and accents are left unchanged.
 *
 * Complements open setup inventory validation-label tip #974 / MISE-005UJ
 * (UI i18n chrome) without sharing that module or rewriting durable
 * inventory-name / recipe / ingredient paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized inventory supplier-required error label
 * before it is embedded in the thrown Error.
 */
export function asciiTrimPresentationSetupInventorySupplierRequiredLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory supplier-required error label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupInventorySupplierRequiredLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupInventorySupplierRequiredLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup inventory supplier-required error label candidate.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * `"Inventory item"` fallback) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback chain owns the
 * intentional English copy without inventing a clean inventory identity from
 * padding.
 */
export function normalizePresentationSetupInventorySupplierRequiredLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional English `"Inventory item"` fallback.
  // Do not invent an error label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupInventorySupplierRequiredLabel(value);
}

/**
 * Resolve setup inventory supplier-required error label under ASCII C.
 * Soft-null / empty leaves the intentional `|| "Inventory item"` fallback to
 * the caller.
 */
export function presentationSetupInventorySupplierRequiredLabel(
  name: string | null | undefined
): string | null {
  return normalizePresentationSetupInventorySupplierRequiredLabel(name);
}
