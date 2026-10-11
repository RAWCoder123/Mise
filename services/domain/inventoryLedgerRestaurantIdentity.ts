/**
 * Inventory ledger restaurant workspace identity helpers (MISE-005MZ).
 *
 * Pins domain-layer inventoryLedger.ts `restaurantId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase or
 * demo storage. Complements open inventory ledger object tip #771
 * (`inventoryItemId` / `clientEventId` / `idempotencyKey`) which intentionally
 * left `restaurantId.trim()` and `source.trim()` on Unicode trim. Complements
 * open inventory application restaurant tip #744 without sharing that helper.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant-a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match contract against stored
 * `event.restaurantId` values.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity before
 * ledger accept/idempotency scoping.
 */
export function asciiTrimInventoryLedgerRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-ledger restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryLedgerRestaurantId(value: string): string | null {
  const trimmed = asciiTrimInventoryLedgerRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}
