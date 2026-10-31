/**
 * Hosted restaurant-tasks create/complete restaurant workspace identity
 * helpers (MISE-005VA).
 *
 * Pins supabaseRepository `createRestaurantTask` /
 * `completeRestaurantTask` post-RPC `input.restaurantId` prep outside the
 * application list/reopen graph so Node tests can exercise inventing proofs
 * without loading Supabase. Prior hosted create/complete Unicode-trimmed the
 * restaurant workspace id before dependency loads and tenant-scope validation
 * (`'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'`), so NBSP/em-space
 * padding invented a clean workspace identity that could match a persisted
 * task row.
 *
 * Open application tip #739 / MISE-005LI owns `listSharedRestaurantTasks` /
 * reopen workspace prep via `restaurantTasksRestaurantIdentity.ts` and left
 * these hosted create/complete `.trim()` call sites alone. This module owns
 * only those two hosted paths and preserves
 * `Restaurant task failed restaurant scope validation.` Soft empty /
 * Unicode-padded / control-bearing / over-long / non-string tokens fail
 * closed under that same hosted contract. Ordinary ASCII whitespace still
 * trims clean. Case is left unchanged (demo tenants use tokens like
 * `restaurant_a`).
 *
 * Do not share with #739 application restaurant-tasks restaurant identity,
 * #762 taskId tip, #810 dependencyIds tip, or the separate
 * `recordRecalculationRun` restaurantId.trim sibling.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized hosted restaurant-tasks restaurant
 * workspace identity before dependency load and scope validation.
 */
export function asciiTrimRestaurantTasksHostedRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a hosted restaurant-tasks create/complete restaurant workspace
 * identity under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, over-long, or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksHostedRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimRestaurantTasksHostedRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by hosted
 * `createRestaurantTask` / `completeRestaurantTask` scope prep. Preserves the
 * existing `Restaurant task failed restaurant scope validation.` error
 * contract.
 */
export function requireCanonicalRestaurantTasksHostedRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant task failed restaurant scope validation.");
  }
  const text = canonicalizeRestaurantTasksHostedRestaurantId(value);
  if (!text) {
    throw new Error("Restaurant task failed restaurant scope validation.");
  }
  return text;
}
