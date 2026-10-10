/**
 * Supplier-delivery domain order identity helpers (MISE-005MR).
 *
 * Pins domain-layer `deliveryClientIdForOrder` `orderId` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Complements open deliveries application supplier-order tip
 * #760 (`Missing supplier order.` / `requireCanonicalDeliveriesSupplierOrderId`)
 * and client-delivery tip #765 (`Missing client delivery id.`) without sharing
 * those helper modules or rewriting application receive paths.
 *
 * Intentionally does not change `receivedAt` handling inside
 * `deliveryClientIdForOrder`. Intentionally does not rewrite application-layer
 * `supplierOrderId.trim()` or `clientDeliveryId?.trim()` on
 * `receiveSupplierOrderDelivery` — those remain owned by #760 / #765.
 *
 * Order IDs embedded in generated `supplier_delivery:…` client ids are not
 * UUID-shaped on every path (demo tokens remain valid). Only ASCII end trim is
 * pinned; case is left unchanged to preserve the existing contract.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized order identity inside the generated
 * client-delivery key.
 */
export function asciiTrimSupplierDeliveryOrderToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a supplier-delivery order identity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, over-long,
 * or containing ASCII controls.
 */
export function canonicalizeSupplierDeliveryOrderId(value: string): string | null {
  const trimmed = asciiTrimSupplierDeliveryOrderToken(value);
  if (!trimmed) return null;
  if (trimmed.length > 128) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Fail-closed order require used by domain `deliveryClientIdForOrder`.
 * Preserves a distinct message from application deliveries tips:
 * `Supplier delivery requires an order id.`
 */
export function requireCanonicalSupplierDeliveryOrderId(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Supplier delivery requires an order id.");
  }
  const text = canonicalizeSupplierDeliveryOrderId(value);
  if (!text) {
    throw new Error("Supplier delivery requires an order id.");
  }
  return text;
}
