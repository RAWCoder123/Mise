/**
 * Orders application object workflow identity helpers (MISE-005MC).
 *
 * Pins application-layer orders.ts `requireWorkflowId` labels "supplier order",
 * "purchase decision event", and "supplier" outside the repository graph so
 * Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Complements open orders restaurant tip #756 (`Missing restaurant.`)
 * without sharing its helper module or rewriting the restaurant label.
 *
 * Intentionally does not change `requireWorkflowId(..., "restaurant")`. That
 * path remains on Unicode trim here and is owned by #756 / MISE-005LZ.
 * Intentionally does not rewrite `fetchPurchaseRecommendationAuthorities`
 * Unicode trim (`Missing restaurant workspace.`) — that path remains #754.
 *
 * Object workflow IDs are not UUID-shaped on every path. Only ASCII end trim
 * is pinned; case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized object workflow identity.
 */
export function asciiTrimOrdersWorkflowObjectToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an orders object workflow identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeOrdersWorkflowObjectId(value: string): string | null {
  const trimmed = asciiTrimOrdersWorkflowObjectToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

export type OrdersWorkflowObjectLabel =
  | "supplier order"
  | "purchase decision event"
  | "supplier";

/**
 * Fail-closed object require used by orders
 * `requireWorkflowId(..., "supplier order" | "purchase decision event" | "supplier")`.
 * Preserves the existing `Missing ${label}.` error contract.
 */
export function requireCanonicalOrdersWorkflowObjectId(
  value: unknown,
  label: OrdersWorkflowObjectLabel
): string {
  if (typeof value !== "string") {
    throw new Error(`Missing ${label}.`);
  }
  const text = canonicalizeOrdersWorkflowObjectId(value);
  if (!text) {
    throw new Error(`Missing ${label}.`);
  }
  return text;
}
