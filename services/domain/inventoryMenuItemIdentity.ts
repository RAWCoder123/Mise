/**
 * Inventory application menu-item object identity helpers (MISE-005MG).
 *
 * Pins application-layer inventory.ts `menuItemId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open inventory restaurant tip #744
 * (`Missing restaurant workspace.` / `requireCanonicalInventoryWorkspaceId`)
 * without sharing its helper module or rewriting the restaurant workspace path.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `confirmRecipeBaselineComplete` (or other inventory application restaurant
 * workspace paths). Those remain on Unicode trim here and are owned by
 * #744 / MISE-005LN.
 * Intentionally does not rewrite recipe-mapping `menuItemName` /
 * `inventoryItemId` / `mappingId` trim surfaces (no menuItemId inventing
 * trim on those paths today).
 *
 * Menu item IDs are not UUID-shaped on every path (demo tokens such as
 * `menu-burger` / `demo-menu:...`). Only ASCII end trim is pinned; case is
 * left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory menu-item object identity.
 */
export function asciiTrimInventoryMenuItemToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory menu-item object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryMenuItemId(value: string): string | null {
  const trimmed = asciiTrimInventoryMenuItemToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed menu-item require used by inventory
 * `confirmRecipeBaselineComplete`. Preserves the existing
 * `Missing menu item.` error contract.
 */
export function requireCanonicalInventoryMenuItemId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing menu item.");
  }
  const text = canonicalizeInventoryMenuItemId(value);
  if (!text) {
    throw new Error("Missing menu item.");
  }
  return text;
}
