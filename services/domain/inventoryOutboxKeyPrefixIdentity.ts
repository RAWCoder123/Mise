/**
 * Inventory outbox storage key-prefix identity helpers (MISE-005NE).
 *
 * Pins repository-layer `inventoryOutboxRepository.ts` `storageKey`
 * `keyPrefix` outside the AsyncStorage / device graph so Node tests can
 * exercise inventing proofs without loading Expo persistence. Complements open
 * inventory outbox entry-id tip #784 without sharing that helper module or
 * rewriting finding-decision outbox key-prefix paths (#786).
 *
 * Intentionally does not change restaurant-id validation on the same
 * `storageKey` path — that remains the existing ASCII class regex gate.
 *
 * Key prefixes are not UUID-shaped (default `mise.inventory-outbox.v1`; tests
 * may inject alternate partitions). Only ASCII end trim is pinned; case is
 * left unchanged to preserve the existing exact storage-key contract. Max
 * length 128 matches sibling object-identity tips.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory-outbox storage partition before
 * list / save / persist.
 */
export function asciiTrimInventoryOutboxKeyPrefixToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-outbox storage key prefix under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeInventoryOutboxKeyPrefix(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryOutboxKeyPrefixToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed key-prefix require used by `storageKey`.
 * Preserves the existing `missing_outbox_key_prefix` error contract.
 */
export function requireCanonicalInventoryOutboxKeyPrefix(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("missing_outbox_key_prefix");
  }
  const text = canonicalizeInventoryOutboxKeyPrefix(value);
  if (!text) {
    throw new Error("missing_outbox_key_prefix");
  }
  return text;
}
