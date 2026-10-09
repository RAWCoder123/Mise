/**
 * Mise-actions restaurant workspace identity helpers (MISE-005LH).
 *
 * Pins domain- and application-layer Mise-action restaurant_id outside the
 * full action / repository graph so Node tests can exercise inventing proofs
 * without loading ledger siblings. Complements open Today (#737),
 * operating-plan (#736), scheduled-recalculation (#735), recalculation-run
 * transport (#734), recalculation-schedule (#733), restaurant-memory (#731),
 * floor-note (#730), and activity-event (#729) restaurant tips without
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
export function asciiTrimMiseActionsRestaurantToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Mise-actions restaurant workspace identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeMiseActionsRestaurantId(value: string): string | null {
  const trimmed = asciiTrimMiseActionsRestaurantToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed restaurant workspace require used by Mise-action domain
 * entry points. Preserves the existing
 * `Mise actions require a restaurant id.` error contract.
 */
export function requireCanonicalMiseActionsRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Mise actions require a restaurant id.");
  }
  const text = canonicalizeMiseActionsRestaurantId(value);
  if (!text) {
    throw new Error("Mise actions require a restaurant id.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by outcome domain entry
 * points. Preserves the existing `Outcomes require a restaurant id.` error
 * contract.
 */
export function requireCanonicalMiseActionsOutcomeRestaurantId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Outcomes require a restaurant id.");
  }
  const text = canonicalizeMiseActionsRestaurantId(value);
  if (!text) {
    throw new Error("Outcomes require a restaurant id.");
  }
  return text;
}

/**
 * Fail-closed restaurant workspace require used by Mise-action application
 * entry points. Preserves the existing `Missing restaurant workspace.` error
 * contract.
 */
export function requireCanonicalMiseActionsWorkspaceId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing restaurant workspace.");
  }
  const text = canonicalizeMiseActionsRestaurantId(value);
  if (!text) {
    throw new Error("Missing restaurant workspace.");
  }
  return text;
}
