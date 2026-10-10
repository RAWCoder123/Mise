/**
 * Inventory count-session inventory-item object identity helpers (MISE-005MN).
 *
 * Pins domain-layer inventoryCountSessions.ts `mergeCountLineUpdates`
 * `inventoryItemId` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Complements open
 * inventory application inventoryItemId tip #767
 * (`Choose an inventory item.` / `requireCanonicalInventoryItemId`) without
 * sharing that helper module or rewriting the recipe-baseline path.
 *
 * Intentionally does not change count-line `note` Unicode trim (operator
 * free-text). Intentionally does not rewrite application inventory.ts
 * restaurant / menuItemId / inventoryItemId paths owned by #744 / #763 / #767.
 *
 * Count-session inventory item IDs are not UUID-shaped on every path (demo
 * tokens such as `tomatoes` / `inv-flour`). Only ASCII end trim is pinned;
 * case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized count-session inventory-item identity.
 */
export function asciiTrimInventoryCountItemToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a count-session inventory-item object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryCountItemId(value: string): string | null {
  const trimmed = asciiTrimInventoryCountItemToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed inventory-item require used by inventory count-session
 * `mergeCountLineUpdates`. Preserves the existing
 * `Count line is missing an inventory item.` error contract.
 */
export function requireCanonicalInventoryCountItemId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Count line is missing an inventory item.");
  }
  const text = canonicalizeInventoryCountItemId(value);
  if (!text) {
    throw new Error("Count line is missing an inventory item.");
  }
  return text;
}
