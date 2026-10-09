/**
 * Recalculation-run transport restaurant workspace identity helpers (MISE-005LD).
 *
 * Pins domain-layer recalculation-run RPC restaurant_id outside the schedule
 * graph so Node tests can exercise inventing proofs without loading
 * application dispatch or schedule siblings. Complements open
 * recalculation-schedule (#733), restaurant-memory (#731), floor-note (#730),
 * activity-event (#729), and purchase-line (#728) restaurant tips without
 * sharing their files. Leaves `scheduledRecalculations` restaurant tips for a
 * separate follow-up.
 *
 * Restaurant workspace IDs are not UUID-shaped on this path (demo tenants use
 * tokens like `restaurant_a`). Only ASCII end trim is pinned; case is left
 * unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized restaurant workspace identity.
 */
export function asciiTrimRecalculationRunTransportRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recalculation-run transport restaurant workspace identity
 * under ASCII C. Returns null when empty after ASCII trim, still
 * Unicode-padded, over-long, or containing ASCII controls.
 */
export function canonicalizeRecalculationRunTransportRestaurantId(
  value: string
): string | null {
  const trimmed = asciiTrimRecalculationRunTransportRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by recalculation-run transport
 * RPC marshalling. Uses
 * `Recalculation run recording requires a restaurant.` so empty, Unicode-padded,
 * and control-bearing tokens fail closed before an invented identity reaches the
 * hosted ledger RPC.
 */
export function requireCanonicalRecalculationRunTransportRestaurantId(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Recalculation run recording requires a restaurant.");
  }
  const text = canonicalizeRecalculationRunTransportRestaurantId(value);
  if (!text) {
    throw new Error("Recalculation run recording requires a restaurant.");
  }
  return text;
}
