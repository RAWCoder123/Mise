/**
 * Durable supplier attribution for ad-hoc operator receipts.
 *
 * Log Delivery and Inventory-detail receives post `source = operator_receipt`.
 * Those rows must record the inventory item's durable `supplier_id` in bounded
 * ledger metadata so later purchasing/learning can attribute the receipt without
 * inventing supplier identity from free-text notes.
 *
 * Order-path receives (`supplier_delivery`) are intentionally out of scope.
 */

export const OPERATOR_RECEIPT_SOURCE = "operator_receipt";
export const RECEIPT_SUPPLIER_METADATA_KEY = "supplier_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RECEIPT_SUPPLIER_MISSING_MESSAGE =
  "Ad-hoc receipts require the item's durable supplier identity.";
export const RECEIPT_SUPPLIER_MISMATCH_MESSAGE =
  "Receipt supplier identity must match the inventory item supplier.";
export const RECEIPT_SUPPLIER_INVALID_MESSAGE =
  "Receipt supplier identity must be a durable supplier UUID.";

export type ReceiptSupplierAttributionRejection =
  | "missing_supplier"
  | "supplier_mismatch"
  | "invalid_supplier";

/** Soft-null read helper for delivery history and audits. */
export function supplierIdFromMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined | null
): string | null {
  if (!metadata) return null;
  return normalizeDurableSupplierId(metadata[RECEIPT_SUPPLIER_METADATA_KEY]);
}

/** Returns a canonical UUID string or null when the value is not usable. */
export function normalizeDurableSupplierId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Stamp authoritative `supplier_id` onto operator_receipt metadata.
 *
 * Non-operator-receipt events are returned unchanged. A client-provided
 * supplier_id that disagrees with the inventory item fails closed rather than
 * being silently overwritten, so forged attribution cannot pass the app path.
 */
export function applyOperatorReceiptSupplierAttribution(input: {
  eventType: string;
  source: string;
  metadata: Readonly<Record<string, unknown>>;
  inventoryItemSupplierId: unknown;
}):
  | { ok: true; metadata: Record<string, unknown> }
  | { ok: false; reason: ReceiptSupplierAttributionRejection; message: string } {
  if (input.eventType !== "receipt" || input.source !== OPERATOR_RECEIPT_SOURCE) {
    return { ok: true, metadata: { ...input.metadata } };
  }

  const authoritative = normalizeDurableSupplierId(input.inventoryItemSupplierId);
  if (!authoritative) {
    return {
      ok: false,
      reason: "missing_supplier",
      message: RECEIPT_SUPPLIER_MISSING_MESSAGE
    };
  }

  if (
    Object.prototype.hasOwnProperty.call(input.metadata, RECEIPT_SUPPLIER_METADATA_KEY)
  ) {
    const providedRaw = input.metadata[RECEIPT_SUPPLIER_METADATA_KEY];
    if (providedRaw !== undefined && providedRaw !== null) {
      const provided = normalizeDurableSupplierId(providedRaw);
      if (!provided) {
        return {
          ok: false,
          reason: "invalid_supplier",
          message: RECEIPT_SUPPLIER_INVALID_MESSAGE
        };
      }
      if (provided !== authoritative) {
        return {
          ok: false,
          reason: "supplier_mismatch",
          message: RECEIPT_SUPPLIER_MISMATCH_MESSAGE
        };
      }
    }
  }

  return {
    ok: true,
    metadata: {
      ...input.metadata,
      [RECEIPT_SUPPLIER_METADATA_KEY]: authoritative
    }
  };
}
