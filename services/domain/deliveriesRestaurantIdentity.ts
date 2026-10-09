/**
 * Deliveries application workspace identity helpers (MISE-005LR).
 *
 * Pins application-layer deliveries.ts restaurant_id outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open daily-phase-brief (#747), operating-brief
 * (#746), pilot-readiness (#745), inventory (#744), restaurant app (#743),
 * setup (#742), autonomy (#741), Insights (#740), restaurant-tasks (#739),
 * Mise-actions (#738), Today (#737), operating-plan (#736), and other
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
export function asciiTrimDeliveriesRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a deliveries restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeDeliveriesRestaurantId(value: string): string | null {
  const trimmed = asciiTrimDeliveriesRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by deliveries application
 * entry points. Preserves the existing `Missing restaurant workspace.` error
 * contract.
 */
export function requireCanonicalDeliveriesWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeDeliveriesRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
