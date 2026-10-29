/**
 * Inventory count-line inventoryItemId identity helpers (MISE-005TT).
 *
 * Pins miseValidation `requireInventoryCountLineUpdates` inventory-item prep
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or AsyncStorage. Count-line `inventoryItemId`
 * previously Unicode-trimmed (`String(...).trim()` only), so NBSP/em-space
 * padding invented a clean durable inventory-item identity before duplicate
 * detection and save-line writes
 * (`'\u2003tomatoes\u2003'.trim() === 'tomatoes'`).
 *
 * Complements open domain count-session inventoryItemId tip #770 /
 * MISE-005MN (`mergeCountLineUpdates`) without sharing that helper module or
 * rewriting the domain merge path. Complements open inventory-operation scope
 * tip #860 / MISE-005PZ and application inventoryItemId tip #767 / MISE-005MK
 * without sharing those helpers. Leave count-line note Unicode/C prep to open
 * #846 / MISE-005PL and domain #827 / MISE-005OS.
 *
 * Count-line inventory item IDs are not UUID-shaped on every path (demo
 * tokens such as `tomatoes` / `inv-flour`). Only ASCII end trim is pinned;
 * case is left unchanged to preserve the existing contract. Max length stays
 * 128 to match the open count-session item-identity bound.
 *
 * Live require preserves the prior indexed messages:
 * `Count line ${n} is missing an inventory item.`
 */

export const INVENTORY_COUNT_LINE_ITEM_ID_MAX_CHARACTERS = 128;

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized count-line inventory-item identity before
 * duplicate detection and save.
 */
export function asciiTrimInventoryCountLineItemToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a count-line inventory-item identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryCountLineItemId(value: string): string | null {
  const trimmed = asciiTrimInventoryCountLineItemToken(value);
  if (!trimmed) return null;
  if (trimmed.length > INVENTORY_COUNT_LINE_ITEM_ID_MAX_CHARACTERS) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed inventory-item require for miseValidation
 * `requireInventoryCountLineUpdates`. Preserves the prior indexed
 * `Count line ${lineNumber} is missing an inventory item.` contract for
 * non-string / empty / unsafe-control / Unicode-padded / over-long.
 */
export function requireCanonicalInventoryCountLineItemId(
  value: unknown,
  lineNumber: number
): string {
  if (typeof value !== "string") {
    throw new Error(`Count line ${lineNumber} is missing an inventory item.`);
  }
  const text = canonicalizeInventoryCountLineItemId(value);
  if (!text) {
    throw new Error(`Count line ${lineNumber} is missing an inventory item.`);
  }
  return text;
}
