/**
 * POS application restaurant identity helpers (MISE-005MA).
 *
 * Pins application-layer pos.ts `requireWorkflowId(..., "restaurant")`
 * restaurant_id outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Complements
 * open orders workflow tip #756 (`Missing restaurant.`) without sharing its
 * files or rewriting non-restaurant POS workflow labels.
 *
 * Intentionally does not change non-restaurant `requireWorkflowId` labels
 * (mapping, menu item). Those remain on Unicode trim with the existing
 * `A valid ${label} id is required.` contract.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimPosRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizePosRestaurantId(value: string): string | null {
  const trimmed = asciiTrimPosRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by POS
 * `requireWorkflowId(..., "restaurant")`. Preserves the existing
 * `A valid restaurant id is required.` error contract.
 */
export function requireCanonicalPosRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("A valid restaurant id is required.");
  }
  const text = canonicalizePosRestaurantId(value);
  if (!text) {
    throw new Error("A valid restaurant id is required.");
  }
  return text;
}
