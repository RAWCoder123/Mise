/**
 * Inventory-operation restaurantId / inventoryItemId scope identity helpers
 * (MISE-005PZ).
 *
 * Pins miseValidation `requireInventoryOperation` required-scope prep outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or AsyncStorage. Operator inventory `restaurantId` and
 * `inventoryItemId` previously Unicode-trimmed (`.trim()` only via
 * `requireBoundedText` inside `requireInventoryOperation`), so NBSP/em-space
 * padding invented a clean durable tenant / item identity before the event
 * was queued (`'\u00a0restaurant-a\u00a0'.trim() === 'restaurant-a'` and
 * `'\u2003chicken\u2003'.trim() === 'chicken'`).
 *
 * These are single-line scope keys (workspace + inventory item), not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Empty, Unicode-padded,
 * control-bearing, over-long, and non-string tokens fail closed rather than
 * inventing equality with the unpadded key.
 *
 * Complements open inventory-operation note tip #854 / MISE-005PT and
 * reference/reason tip #855 / MISE-005PU without sharing those modules or
 * rewriting sibling `optionalBoundedText` paths that still Unicode-trim on
 * main. Complements open inventory ledger restaurant (#782) / object (#771)
 * and application inventoryItemId (#767) / count-session inventoryItemId
 * (#770) tips without sharing those helpers — this tip owns only the
 * operator `requireInventoryOperation` boundary.
 *
 * Max lengths stay 200 to match the prior `requireBoundedText(..., 200)`
 * bounds. Live require preserves the prior messages
 * (`Enter a valid restaurant.` / `Enter a valid inventory item.`).
 */

import {
  INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS,
  INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
} from "./securityLimits";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized inventory-operation restaurant or
 * inventory-item identity before the operator event is queued.
 */
export function asciiTrimInventoryOperationScopeToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an inventory-operation restaurantId / inventoryItemId token
 * under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, over-long for the given bound, or containing ASCII
 * controls.
 */
export function canonicalizeInventoryOperationScopeToken(
  value: string,
  maximum: number
): string | null {
  const trimmed = asciiTrimInventoryOperationScopeToken(value);
  if (!trimmed) return null;
  if (trimmed.length > maximum) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurantId require for `requireInventoryOperation` and
 * inventing proofs. Preserves the prior `Enter a valid restaurant.` contract
 * for non-string / empty / unsafe-control / Unicode-padded / over-long.
 */
export function requireCanonicalInventoryOperationRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Enter a valid restaurant.");
  }
  const canonical = canonicalizeInventoryOperationScopeToken(
    value,
    INVENTORY_OPERATION_RESTAURANT_ID_MAX_CHARACTERS
  );
  if (!canonical) {
    throw new Error("Enter a valid restaurant.");
  }
  return canonical;
}

/**
 * Fail-closed inventoryItemId require for `requireInventoryOperation` and
 * inventing proofs. Preserves the prior `Enter a valid inventory item.`
 * contract for non-string / empty / unsafe-control / Unicode-padded /
 * over-long.
 */
export function requireCanonicalInventoryOperationInventoryItemId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Enter a valid inventory item.");
  }
  const canonical = canonicalizeInventoryOperationScopeToken(
    value,
    INVENTORY_OPERATION_INVENTORY_ITEM_ID_MAX_CHARACTERS
  );
  if (!canonical) {
    throw new Error("Enter a valid inventory item.");
  }
  return canonical;
}
