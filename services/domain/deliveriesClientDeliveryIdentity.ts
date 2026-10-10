/**
 * Deliveries application client-delivery identity helpers (MISE-005MI).
 *
 * Pins application-layer deliveries.ts optional `clientDeliveryId` outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or demo storage. Complements open deliveries restaurant tip #748
 * (`Missing restaurant workspace.`) and open supplier-order tip #760
 * (`Missing supplier order.` / `requireCanonicalDeliveriesSupplierOrderId`)
 * without sharing those helper modules or rewriting those paths.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `fetchDeliveryHistory` / `receiveSupplierOrderDelivery`. That path remains
 * on Unicode trim here and is owned by #748 / MISE-005LR.
 * Intentionally does not rewrite `supplierOrderId.trim()` — that object path
 * remains on Unicode trim here and is owned by #760 / MISE-005MD.
 *
 * Client delivery IDs are not UUID-shaped on every path (demo tokens such as
 * `demo-delivery-pantry-1`, and generated `supplier_delivery:…` ids). Only
 * ASCII end trim is pinned; case is left unchanged to preserve the existing
 * contract. Max length matches the hosted
 * `supplier_deliveries.client_delivery_id` bound (200).
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized client-delivery identity.
 */
export function asciiTrimDeliveriesClientDeliveryToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a deliveries client-delivery identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeDeliveriesClientDeliveryId(value: string): string | null {
  const trimmed = asciiTrimDeliveriesClientDeliveryToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 200) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed client-delivery require used when an operator-provided
 * `clientDeliveryId` is present and non-empty after ASCII trim.
 * Preserves a stable `Missing client delivery id.` error contract.
 */
export function requireCanonicalDeliveriesClientDeliveryId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing client delivery id.");
  }
  const text = canonicalizeDeliveriesClientDeliveryId(value);
  if (!text) {
    throw new Error("Missing client delivery id.");
  }
  return text;
}

/**
 * Optional client-delivery resolve for `receiveSupplierOrderDelivery`.
 * Omitted / ASCII-empty values keep the existing generated fallback.
 * Unicode-padded, control-bearing, or over-long provided tokens fail closed
 * instead of inventing an identity via Unicode `trim()`.
 */
export function resolveCanonicalDeliveriesClientDeliveryId(
  value: unknown,
  fallback: string
): string {
  if (value == null) return fallback;
  if (typeof value !== "string") {
    throw new Error("Missing client delivery id.");
  }
  const asciiTrimmed = asciiTrimDeliveriesClientDeliveryToken(value);
  if (!asciiTrimmed) return fallback;
  return requireCanonicalDeliveriesClientDeliveryId(value);
}
