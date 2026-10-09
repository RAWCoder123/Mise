/**
 * Restaurant-tasks restaurant workspace identity helpers (MISE-005LI).
 *
 * Pins application-layer shared restaurant-task restaurant_id outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open Mise-actions (#738), Today (#737),
 * operating-plan (#736), scheduled-recalculation (#735), recalculation-run
 * transport (#734), recalculation-schedule (#733), restaurant-memory (#731),
 * floor-note (#730), and activity-event (#729) restaurant tips without sharing
 * their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimRestaurantTasksRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksRestaurantId(value: string): string | null {
  const trimmed = asciiTrimRestaurantTasksRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by restaurant-task list
 * entry points. Preserves the existing `Missing restaurant workspace.` error
 * contract.
 */
export function requireCanonicalRestaurantTasksWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeRestaurantTasksRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by restaurant-task reopen
 * entry points. Preserves the existing `Restaurant and task are required.`
 * error contract for the restaurant half of that check.
 */
export function requireCanonicalRestaurantTasksReopenRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant and task are required.");
  }
  const text = canonicalizeRestaurantTasksRestaurantId(value);
  if (!text) {
    throw new Error("Restaurant and task are required.");
  }
  return text;
}
