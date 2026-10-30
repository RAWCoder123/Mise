/**
 * Setup inventory quantity/par assertBounded error label identity helpers
 * (MISE-005UO).
 *
 * Pins application-layer `validateSetupInput` presentation
 * `item.name || "Inventory item"` quantity / par-level assertBounded error
 * labels outside the repository graph so Node tests can exercise inventing
 * proofs without loading Expo UI. Prior quantity / par labels embedded the
 * raw draft inventory item name, so:
 *
 * - Unicode-only space (`'\u2003'`) is truthy and bypassed the intentional
 *   English `"Inventory item"` fallback, embedding padding into
 *   `"… quantity"` / `"… par level"` Error text; and
 * - em-space / NBSP-padded names (`'\u2003Roma Tomatoes\u2003'`) would invent
 *   a clean inventory identity under Unicode `.trim()` (the sibling
 *   supplier-required path that open #977 / MISE-005UM already pins). Soft-
 *   null refuse keeps those padded tokens from inventing a clean label or
 *   from embedding padding into assertBounded Errors.
 *
 * Soft empty / Unicode-only space / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| "Inventory item"` branch preserves the
 * intentional English fallback. Ordinary ASCII whitespace still trims clean.
 * Case and accents are left unchanged.
 *
 * These are presentation **setup inventory quantity/par assertBounded error
 * labels** only — not supplier-required error labels (#977 / MISE-005UM), not
 * setup-screen inventory validation labels (#974 / MISE-005UJ), not durable
 * setup inventory item names (#903 / MISE-005RQ), not setup inventory-name
 * keys (#679 / MISE-005JJ), not recipe / ingredient validation labels
 * (#975 / #976), not setup supplier ChoiceChip labels (#973), not durable
 * setup `supplierNames` (#904), not quantity/par draft identity tips
 * (#895 / #894), and not the save-path `draft.name.trim()` durable
 * `item_name` write (open #679).
 *
 * Complements open tip #977 / MISE-005UM (supplier-required Error labels)
 * without sharing that module. When landing with #977, drop #977's assertion
 * that quantity/par labels still use raw `item.name || "Inventory item"`.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized inventory quantity/par error label before
 * it is embedded in the thrown Error.
 */
export function asciiTrimPresentationSetupInventoryQuantityParLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory quantity/par assertBounded error label under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupInventoryQuantityParLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupInventoryQuantityParLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup inventory quantity/par assertBounded error label
 * candidate. Preserves soft empty → null (including Unicode-only space that
 * previously bypassed `|| "Inventory item"` because it is a truthy string)
 * while refusing to invent a clean label via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * fallback chain owns the intentional English copy without inventing a clean
 * inventory identity from padding.
 */
export function normalizePresentationSetupInventoryQuantityParLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior raw
  // `item.name || "Inventory item"` treated those as truthy and embedded
  // padding into quantity/par Errors. Do not invent an error label from
  // padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupInventoryQuantityParLabel(value);
}

/**
 * Resolve setup inventory quantity/par assertBounded error label under
 * ASCII C. Soft-null / empty leaves the intentional `|| "Inventory item"`
 * fallback to the caller.
 */
export function presentationSetupInventoryQuantityParLabel(
  name: string | null | undefined
): string | null {
  return normalizePresentationSetupInventoryQuantityParLabel(name);
}
