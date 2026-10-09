/**
 * Floor-note / operator-task restaurant workspace identity helpers (MISE-005LA).
 *
 * Pins application-layer floor-note restaurant_id outside the AsyncStorage
 * graph so Node tests can exercise inventing proofs without loading React
 * Native storage. Complements open activity-event (#729), purchase-line (#728),
 * and supplier-recipient (#727) restaurant tips without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimFloorNoteRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a floor-note restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeFloorNoteRestaurantId(value: string): string | null {
  const trimmed = asciiTrimFloorNoteRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by floor-note / operator-task
 * application entry points. Preserves the existing
 * `Missing restaurant workspace.` error contract.
 */
export function requireCanonicalFloorNoteRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeFloorNoteRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
