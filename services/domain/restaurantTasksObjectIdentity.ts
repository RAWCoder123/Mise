/**
 * Restaurant-tasks application object identity helpers (MISE-005MF).
 *
 * Pins application-layer restaurantTasks.ts `taskId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open restaurant-tasks restaurant tip #739
 * (`Missing restaurant workspace.` / reopen restaurant half of
 * `Restaurant and task are required.`) without sharing its helper module or
 * rewriting the restaurant workspace path.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `listSharedRestaurantTasks` / `reopenSharedRestaurantTask`. Those paths
 * remain on Unicode trim here and are owned by #739 / MISE-005LI.
 * Intentionally does not rewrite `completeSharedRestaurantTask` input
 * normalization (domain `requiredText` owns that path).
 *
 * Task IDs are not UUID-shaped on every path. Only ASCII end trim is pinned;
 * case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant-task object identity.
 */
export function asciiTrimRestaurantTasksObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a restaurant-tasks object identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeRestaurantTasksObjectId(value: string): string | null {
  const trimmed = asciiTrimRestaurantTasksObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed task require used by restaurant-tasks
 * `reopenSharedRestaurantTask`. Preserves the existing
 * `Restaurant and task are required.` error contract for the task half.
 */
export function requireCanonicalRestaurantTasksTaskId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant and task are required.");
  }
  const text = canonicalizeRestaurantTasksObjectId(value);
  if (!text) {
    throw new Error("Restaurant and task are required.");
  }
  return text;
}
