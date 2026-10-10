/**
 * Inventory ledger object identity helpers (MISE-005MO).
 *
 * Pins domain-layer inventoryLedger.ts `inventoryItemId` / `clientEventId` /
 * `idempotencyKey` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage.
 *
 * Intentionally does not change `restaurantId.trim()` or `source.trim()` on
 * `validateEventInput` — restaurant workspace and source labels remain on
 * Unicode trim in this tip. Intentionally does not rewrite application
 * inventory.ts inventoryItemId (#767 / MISE-005MK) or count-session
 * inventoryItemId (#770 / MISE-005MN).
 *
 * Ledger object IDs are not UUID-shaped on every path (demo tokens such as
 * `chicken` / `device-event-1`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory-ledger object identity.
 */
export function asciiTrimInventoryLedgerObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-ledger object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryLedgerObjectId(value: string): string | null {
  const trimmed = asciiTrimInventoryLedgerObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}
