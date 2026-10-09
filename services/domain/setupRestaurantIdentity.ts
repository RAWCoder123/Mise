/**
 * Setup restaurant workspace identity helpers (MISE-005LL).
 *
 * Pins application-layer saveRestaurantSetup restaurant_id outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open autonomy (#741), Insights (#740),
 * restaurant-tasks (#739), Mise-actions (#738), Today (#737), operating-plan
 * (#736), scheduled-recalculation (#735), recalculation-run transport (#734),
 * recalculation-schedule (#733), restaurant-memory (#731), floor-note (#730),
 * activity-event (#729), and purchase-line (#728) restaurant tips without
 * sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimSetupRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSetupRestaurantId(value: string): string | null {
  const trimmed = asciiTrimSetupRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by setup application entry
 * points. Preserves the existing `Missing restaurant workspace.` error
 * contract.
 */
export function requireCanonicalSetupWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeSetupRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
