/**
 * Today-tasks restaurant workspace identity helpers (MISE-005LG).
 *
 * Pins domain- and application-layer Today restaurant_id outside the full
 * Today / repository graph so Node tests can exercise inventing proofs without
 * loading ledger siblings. Complements open operating-plan (#736),
 * scheduled-recalculation (#735), recalculation-run transport (#734),
 * recalculation-schedule (#733), restaurant-memory (#731), floor-note (#730),
 * and activity-event (#729) restaurant tips without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimTodayTasksRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Today-tasks restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeTodayTasksRestaurantId(value: string): string | null {
  const trimmed = asciiTrimTodayTasksRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by Today-tasks domain
 * entry points. Preserves the existing
 * `A restaurant is required to derive Today tasks.` error contract.
 */
export function requireCanonicalTodayTasksRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("A restaurant is required to derive Today tasks.");
  }
  const text = canonicalizeTodayTasksRestaurantId(value);
  if (!text) {
    throw new Error("A restaurant is required to derive Today tasks.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by Today application
 * entry points. Preserves the existing `Missing restaurant workspace.` error
 * contract.
 */
export function requireCanonicalTodayTasksWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeTodayTasksRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
