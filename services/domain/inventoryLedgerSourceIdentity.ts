/**
 * Inventory ledger source-label identity helpers (MISE-005NA).
 *
 * Pins domain-layer inventoryLedger.ts `source` outside the repository graph
 * so Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Complements open inventory ledger object tip #771
 * (`inventoryItemId` / `clientEventId` / `idempotencyKey`) and restaurant tip
 * #782 (`restaurantId`) which intentionally left `source.trim()` on Unicode
 * trim.
 *
 * Source labels are free-form operational tags (`receiving`, `pos_sync`, …),
 * not UUID-shaped. Only ASCII end trim is pinned; case is left unchanged to
 * preserve the existing exact-match contract against stored `event.source`
 * values. Length is capped at 80 to mirror
 * `inventory_events.source` CHECK (length(trim(source)) between 1 and 80).
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized ledger source identity before accept /
 * payload equality.
 */
export function asciiTrimInventoryLedgerSourceToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-ledger source label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryLedgerSource(value: string): string | null {
  const trimmed = asciiTrimInventoryLedgerSourceToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}
