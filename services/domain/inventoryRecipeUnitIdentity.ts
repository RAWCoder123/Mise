/**
 * Inventory recipe-mapping unit identity helpers (MISE-005QD).
 *
 * Pins application-layer `addRecipeBaselineIngredient` `unit` text outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Recipe baseline mapping previously Unicode-trimmed
 * on persist (`input.unit.trim()`), so NBSP/em-space padding invented a clean
 * durable recipe-mapping unit before compatibility checks and mapping writes
 * (`'\u2003lb\u2003'.trim() === 'lb'`). Soft-empty Unicode-only padding also
 * collapsed through `.trim()` into the intentional empty gate
 * (`Inventory unit is required.`).
 *
 * Complements open setup inventory/recipe unit tip #861 / MISE-005QA,
 * inventoryUnits client fold #669 / MISE-005JA, operationalMapping unit tip
 * #709 / MISE-005KN, inventory `inventoryItemId` tip #767 / MISE-005MK,
 * inventory recipe-mapping menuItemName tip #863 / MISE-005QC, and inventory
 * items unit SQL cntrl pin #586 / MISE-005FV without sharing those modules or
 * rewriting sibling inventory application field trims (`menuItemName`,
 * `inventoryItemId`, restaurant workspace, comparison `.toLowerCase()` match
 * keys). Those remain on their existing contracts in this tip.
 *
 * Recipe-mapping units are single-line inventory unit identity text, not
 * free-form multiline prose. Only ASCII end trim is pinned; case and accents
 * are left unchanged so presentation stays operator-faithful. Soft empty
 * (ASCII whitespace or Unicode-only space) and Unicode-padded non-empty
 * tokens fail closed with the existing empty-gate error rather than inventing
 * equality with the unpadded unit. Compatibility against the inventory item
 * unit still runs after canonicalize; this tip does not invent a client-side
 * unit vocabulary fold.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized recipe-mapping unit before it is stored as
 * durable mapping identity and used for unit compatibility.
 */
export function asciiTrimInventoryRecipeUnitToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipe-mapping unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryRecipeUnitToken(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryRecipeUnitToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for callers that preserve soft empty → null while
 * refusing to invent a clean unit via Unicode em-space trim. Does not throw;
 * Unicode-padded non-empty tokens return null so the live fail-closed require
 * owns the error.
 */
export function canonicalizeInventoryRecipeUnit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a unit from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryRecipeUnitToken(value);
}

/**
 * Fail-closed unit require for `addRecipeBaselineIngredient`.
 * Soft empty, Unicode-padded, unsafe-control, and non-string tokens fail
 * closed with the existing empty-gate contract.
 *
 * Error contract: `Inventory unit is required.`
 */
export function requireCanonicalInventoryRecipeUnit(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    throw new Error("Inventory unit is required.");
  }
  if (typeof value !== "string") {
    throw new Error("Inventory unit is required.");
  }
  const canonical = canonicalizeInventoryRecipeUnitToken(value);
  if (canonical) return canonical;
  throw new Error("Inventory unit is required.");
}
