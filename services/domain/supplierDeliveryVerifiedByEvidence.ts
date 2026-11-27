/**
 * Structural audit evidence for supplier delivery verifier attribution.
 *
 * `supplier_deliveries.verified_by` is nullable so account-deletion
 * anonymization can clear only the deleted operator's auth identity while
 * preserving the delivery's operational history (`ON DELETE SET NULL`).
 *
 * Hosted `public.record_supplier_delivery` stamps `auth.uid()` into
 * `verified_by` on INSERT. On current main, any INSERT that reaches the table
 * can still mint a delivery receipt with `verified_by = null` — an
 * unattributable physical-receipt record that Activity / audit analysis cannot
 * pin to an operator.
 *
 * This tip fails closed on INSERT when `verified_by` is absent. It does not
 * restore table-level NOT NULL / CHECK (that would block auth anonymization
 * UPDATEs) or rewrite the record_supplier_delivery writer. Orthogonal to
 * supplier_delivery inventory receipt provenance (#1259), receipt source
 * allowlists (#1263), and purchase-line / inventory actor tips.
 */

function hasActor(value: string | null | undefined): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Domain rejection reason for missing verifier attribution on insert.
 * Returns null when a non-empty verifier id is present.
 */
export function validateSupplierDeliveryVerifiedByEvidence(input: {
  verifiedBy?: string | null;
}): string | null {
  if (!hasActor(input.verifiedBy)) {
    return "missing_verified_by";
  }
  return null;
}
