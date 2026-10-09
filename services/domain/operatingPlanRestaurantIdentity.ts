/**
 * Operating-plan restaurant workspace identity helpers (MISE-005LF).
 *
 * Pins domain- and application-layer daily operating plan restaurant_id outside
 * the full Today / repository graph so Node tests can exercise inventing proofs
 * without loading ledger siblings. Complements open scheduled-recalculation
 * (#735), recalculation-run transport (#734), recalculation-schedule (#733),
 * restaurant-memory (#731), floor-note (#730), and activity-event (#729)
 * restaurant tips without sharing their files.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimOperatingPlanRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an operating-plan restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOperatingPlanRestaurantId(value: string): string | null {
  const trimmed = asciiTrimOperatingPlanRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by operating-plan domain
 * entry points. Preserves the existing
 * `A restaurant is required to build an operating plan.` error contract.
 */
export function requireCanonicalOperatingPlanRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("A restaurant is required to build an operating plan.");
  }
  const text = canonicalizeOperatingPlanRestaurantId(value);
  if (!text) {
    throw new Error("A restaurant is required to build an operating plan.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by operating-plan application
 * entry points. Preserves the existing `Missing restaurant workspace.` error
 * contract.
 */
export function requireCanonicalOperatingPlanWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeOperatingPlanRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
