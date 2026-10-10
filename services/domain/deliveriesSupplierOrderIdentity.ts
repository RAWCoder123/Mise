/**
 * Deliveries application supplier-order identity helpers (MISE-005MD).
 *
 * Pins application-layer deliveries.ts `supplierOrderId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open deliveries restaurant tip #748
 * (`Missing restaurant workspace.`) without sharing its helper module or
 * rewriting the restaurant workspace path.
 *
 * Intentionally does not change `restaurantId.trim()` on
 * `fetchDeliveryHistory` / `receiveSupplierOrderDelivery`. That path remains
 * on Unicode trim here and is owned by #748 / MISE-005LR.
 * Intentionally does not rewrite `clientDeliveryId?.trim()` — that optional
 * client token remains a separate surface.
 *
 * Supplier order IDs are not UUID-shaped on every path. Only ASCII end trim
 * is pinned; case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized supplier-order identity.
 */
export function asciiTrimDeliveriesSupplierOrderToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a deliveries supplier-order identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeDeliveriesSupplierOrderId(value: string): string | null {
  const trimmed = asciiTrimDeliveriesSupplierOrderToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed supplier-order require used by deliveries
 * `receiveSupplierOrderDelivery`. Preserves the existing
 * `Missing supplier order.` error contract.
 */
export function requireCanonicalDeliveriesSupplierOrderId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Missing supplier order.");
  }
  const text = canonicalizeDeliveriesSupplierOrderId(value);
  if (!text) {
    throw new Error("Missing supplier order.");
  }
  return text;
}
