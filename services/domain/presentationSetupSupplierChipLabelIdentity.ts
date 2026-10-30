/**
 * Setup inventory-step supplier ChoiceChip label identity helpers
 * (MISE-005UI).
 *
 * Pins setup-screen `supplier.name.trim() || t("setup.validation.supplierLabel", …)`
 * chip prep outside the Expo UI graph so Node tests can exercise inventing
 * proofs without loading React Native. Prior inventory-step supplier chips
 * Unicode-trimmed the draft supplier name before rendering the ChoiceChip
 * label (`'\u2003Fresh Farms\u2003'.trim() === 'Fresh Farms'`), so
 * NBSP/em-space padding invented a clean supplier identity rendered into
 * setup inventory chrome. Soft empty / Unicode-only space also collapsed
 * through `.trim()` into the intentional i18n supplierLabel fallback.
 *
 * These are presentation **setup supplier ChoiceChip labels** only — not
 * durable setup `supplierNames` collection (#904 / MISE-005RR), not auth
 * setup-screen supplier identity (#696 / MISE-005KA), not setup supplier
 * name/email client saves (#680 / MISE-005JK), not setup inventory item
 * names (#903 / MISE-005RQ), not setup inventory validation labels
 * (`item.name.trim() || t("setup.validation.inventoryLabel")`), not recipe /
 * ingredient validation labels, not Create Task assignee chip labels
 * (#963 / MISE-005TY), not Login email chip labels (#971 / MISE-005UG), and
 * not supplier draft line labels (#972 / MISE-005UH). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so padded supplier
 * names cannot invent a clean chip label; the live
 * `|| t("setup.validation.supplierLabel", …)` branch then preserves the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean. Case and accents are left unchanged.
 *
 * Complements open setup supplierNames tip #904 / MISE-005RR (which
 * explicitly left chip labels alone) without sharing that module or
 * rewriting durable supplier name / email / inventory-name paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized supplier chip label before it is
 * rendered into setup inventory ChoiceChip chrome.
 */
export function asciiTrimPresentationSetupSupplierChipLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup supplier ChoiceChip label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSetupSupplierChipLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSetupSupplierChipLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one setup supplier chip label candidate.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * i18n supplierLabel fallback) while refusing to invent a clean label via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback chain owns the
 * intentional supplierLabel copy without inventing a clean supplier
 * identity from padding.
 */
export function normalizePresentationSetupSupplierChipLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n supplierLabel fallback. Do
  // not invent a chip label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSetupSupplierChipLabel(value);
}

/**
 * Resolve setup inventory-step supplier ChoiceChip label under ASCII C.
 * Soft-null / empty leaves the intentional
 * `|| t("setup.validation.supplierLabel", …)` fallback to the caller.
 */
export function presentationSetupSupplierChipLabel(
  name: string | null | undefined
): string | null {
  return normalizePresentationSetupSupplierChipLabel(name);
}
