/**
 * Inventory recipe-mapping menu item name identity helpers (MISE-005QC).
 *
 * Pins application-layer `addRecipeBaselineIngredient` `menuItemName` text
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Recipe baseline mapping previously
 * Unicode-trimmed on persist (`input.menuItemName.trim()`), so NBSP/em-space
 * padding invented a clean durable `menu_item_name` before recipe-mapping
 * writes (`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`).
 * Soft-empty Unicode-only padding also collapsed through `.trim()` into the
 * intentional empty gate (`Enter the POS menu item name.`).
 *
 * Complements open inventory `menuItemId` tip #763 / MISE-005MG, inventory
 * `inventoryItemId` tip #767 / MISE-005MK, inventory recipe menu-item key tip
 * #678 / MISE-005JI, setup recipe dishName tip #862 / MISE-005QB, and
 * `menu_item_ingredients.menu_item_name` SQL cntrl pin #599 / MISE-005GI
 * without sharing those modules or rewriting sibling inventory application
 * field trims (`inventoryItemId`, `unit`, restaurant workspace, comparison
 * `.toLowerCase()` match keys). Those remain on their existing contracts in
 * this tip.
 *
 * Menu item names are single-line POS / recipe mapping identity text, not
 * free-form multiline prose. Only ASCII end trim is pinned; case and accents
 * are left unchanged so presentation stays operator-faithful. Soft empty
 * (ASCII whitespace or Unicode-only space) and Unicode-padded non-empty
 * tokens fail closed with the existing empty-gate error rather than inventing
 * equality with the unpadded name. Hosted writers already bound
 * `menu_item_name` to 1..200; this tip does not invent a new client length
 * gate.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized recipe-mapping menu item name before it is
 * stored as durable `menu_item_name` identity.
 */
export function asciiTrimInventoryRecipeMenuItemNameToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipe-mapping menu item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryRecipeMenuItemNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryRecipeMenuItemNameToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for callers that preserve soft empty → null while
 * refusing to invent a clean menu item name via Unicode em-space trim. Does
 * not throw; Unicode-padded non-empty tokens return null so the live
 * fail-closed require owns the error.
 */
export function canonicalizeInventoryRecipeMenuItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a menu item name from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryRecipeMenuItemNameToken(value);
}

/**
 * Fail-closed menu item name require for `addRecipeBaselineIngredient`.
 * Soft empty, Unicode-padded, unsafe-control, and non-string tokens fail
 * closed with the existing empty-gate contract.
 *
 * Error contract: `Enter the POS menu item name.`
 */
export function requireCanonicalInventoryRecipeMenuItemName(
  value: unknown
): string {
  if (value === null || value === undefined || value === "") {
    throw new Error("Enter the POS menu item name.");
  }
  if (typeof value !== "string") {
    throw new Error("Enter the POS menu item name.");
  }
  const canonical = canonicalizeInventoryRecipeMenuItemNameToken(value);
  if (canonical) return canonical;
  throw new Error("Enter the POS menu item name.");
}
