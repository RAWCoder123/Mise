/**
 * Inventory outbox entry-id identity helpers (MISE-005NB).
 *
 * Pins domain-layer inventoryOutbox.ts `createInventoryOutboxEntry` `id`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Complements open inventory ledger
 * object tip #771 (`inventoryItemId` / `clientEventId` / `idempotencyKey`),
 * restaurant tip #782 (`restaurantId`), and source tip #783 (`source`) without
 * sharing those helper modules or rewriting those paths.
 *
 * Intentionally does not change
 * `input.event.clientEventId.trim()` / `input.event.idempotencyKey.trim()`
 * emptiness checks on `createInventoryOutboxEntry`. Those event object
 * identities remain on Unicode trim here and are owned by #771 /
 * MISE-005MO (ledger accept canonicalize).
 *
 * Outbox entry IDs are not UUID-shaped on every path (tests use tokens such as
 * `outbox-1`; production uses `createId("inventory_outbox")` →
 * `inventory_outbox_<uuid>`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing exact-match / localeCompare contract.
 * Max length 128 matches sibling object-identity tips.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory-outbox entry identity before
 * create / sort / persist.
 */
export function asciiTrimInventoryOutboxIdToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-outbox entry id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryOutboxId(value: string): string | null {
  const trimmed = asciiTrimInventoryOutboxIdToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed outbox entry-id require used by `createInventoryOutboxEntry`.
 * Preserves the existing `missing_outbox_id` error contract.
 */
export function requireCanonicalInventoryOutboxId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("missing_outbox_id");
  }
  const text = canonicalizeInventoryOutboxId(value);
  if (!text) {
    throw new Error("missing_outbox_id");
  }
  return text;
}
