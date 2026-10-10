/**
 * Inventory application inventory-item object identity helpers (MISE-005MK).
 *
 * Pins application-layer inventory.ts `inventoryItemId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open inventory restaurant tip #744
 * (`Missing restaurant workspace.` / `requireCanonicalInventoryWorkspaceId`)
 * and open inventory menuItemId tip #763
 * (`Missing menu item.` / `requireCanonicalInventoryMenuItemId`) without
 * sharing those helper modules or rewriting their paths.
 *
 * Intentionally does not change `restaurantId.trim()` on inventory application
 * restaurant workspace paths. Those remain on Unicode trim here and are owned
 * by #744 / MISE-005LN.
 * Intentionally does not rewrite `confirmRecipeBaselineComplete` `menuItemId`
 * trim (owned by #763 / MISE-005MG) or recipe-mapping `menuItemName` /
 * `mappingId` / `unit` trim surfaces.
 *
 * Inventory item IDs are not UUID-shaped on every path (demo tokens such as
 * `inv-flour` / `demo-item:...`). Only ASCII end trim is pinned; case is
 * left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory-item object identity.
 */
export function asciiTrimInventoryItemToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-item object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryItemId(value: string): string | null {
  const trimmed = asciiTrimInventoryItemToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed inventory-item require used by inventory
 * `addRecipeBaselineIngredient`. Preserves the existing
 * `Choose an inventory item.` error contract.
 */
export function requireCanonicalInventoryItemId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Choose an inventory item.");
  }
  const text = canonicalizeInventoryItemId(value);
  if (!text) {
    throw new Error("Choose an inventory item.");
  }
  return text;
}
