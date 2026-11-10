/**
 * Durable supplier attribution for order-path supplier delivery receipts.
 *
 * Mark Received / `record_supplier_delivery` posts `source = supplier_delivery`.
 * Those ledger rows must record the supplier order's durable `supplier_id` in
 * bounded metadata so purchasing and learning can attribute the receipt without
 * inventing identity from free-text `supplierName`.
 *
 * Ad-hoc Log Delivery (`operator_receipt`) attribution is intentionally out of
 * scope — that tip stamps from the inventory item supplier instead.
 */

export const SUPPLIER_DELIVERY_SOURCE = "supplier_delivery";
export const SUPPLIER_DELIVERY_SUPPLIER_METADATA_KEY = "supplier_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SUPPLIER_DELIVERY_SUPPLIER_MISSING_MESSAGE =
  "Supplier delivery receipts require the order's durable supplier identity.";
export const SUPPLIER_DELIVERY_SUPPLIER_MISMATCH_MESSAGE =
  "Supplier delivery receipt identity must match the supplier order.";
export const SUPPLIER_DELIVERY_SUPPLIER_INVALID_MESSAGE =
  "Supplier delivery receipt identity must be a durable supplier UUID.";

export type SupplierDeliveryReceiptAttributionRejection =
  | "missing_supplier"
  | "supplier_mismatch"
  | "invalid_supplier";

/** Soft-null read helper for delivery history, audits, and learning. */
export function supplierIdFromDeliveryMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined | null
): string | null {
  if (!metadata) return null;
  return normalizeDurableSupplierId(metadata[SUPPLIER_DELIVERY_SUPPLIER_METADATA_KEY]);
}

/** Returns a canonical UUID string or null when the value is not usable. */
export function normalizeDurableSupplierId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Stamp authoritative order `supplier_id` onto supplier_delivery metadata.
 *
 * Non-supplier-delivery events are returned unchanged. A client-provided
 * supplier_id that disagrees with the order fails closed rather than being
 * silently overwritten, so forged attribution cannot pass the app path.
 */
export function applySupplierDeliveryReceiptAttribution(input: {
  eventType: string;
  source: string;
  metadata: Readonly<Record<string, unknown>>;
  orderSupplierId: unknown;
}):
  | { ok: true; metadata: Record<string, unknown> }
  | {
      ok: false;
      reason: SupplierDeliveryReceiptAttributionRejection;
      message: string;
    } {
  if (input.eventType !== "receipt" || input.source !== SUPPLIER_DELIVERY_SOURCE) {
    return { ok: true, metadata: { ...input.metadata } };
  }

  const authoritative = normalizeDurableSupplierId(input.orderSupplierId);
  if (!authoritative) {
    return {
      ok: false,
      reason: "missing_supplier",
      message: SUPPLIER_DELIVERY_SUPPLIER_MISSING_MESSAGE
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(
      input.metadata,
      SUPPLIER_DELIVERY_SUPPLIER_METADATA_KEY
    )
  ) {
    const providedRaw = input.metadata[SUPPLIER_DELIVERY_SUPPLIER_METADATA_KEY];
    if (providedRaw !== undefined && providedRaw !== null) {
      const provided = normalizeDurableSupplierId(providedRaw);
      if (!provided) {
        return {
          ok: false,
          reason: "invalid_supplier",
          message: SUPPLIER_DELIVERY_SUPPLIER_INVALID_MESSAGE
        };
      }
      if (provided !== authoritative) {
        return {
          ok: false,
          reason: "supplier_mismatch",
          message: SUPPLIER_DELIVERY_SUPPLIER_MISMATCH_MESSAGE
        };
      }
    }
  }

  return {
    ok: true,
    metadata: {
      ...input.metadata,
      [SUPPLIER_DELIVERY_SUPPLIER_METADATA_KEY]: authoritative
    }
  };
}
