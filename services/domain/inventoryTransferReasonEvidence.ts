/**
 * Audit evidence required for inventory transfer ledger reason codes.
 *
 * Hosted `public.record_inventory_event` already accepts transfer for
 * owner/admin/manager. On current main, non-specialized projection adds the
 * event quantity to on-hand, so a forged transfer reason can rewrite stock
 * under transfer semantics with missing or free-form provenance that cannot
 * be compared for Activity / station-transfer analysis.
 *
 * The production station-transfer writer (PR #1100 `transfer_inventory`) stamps
 * exactly:
 *   reason_code = station_transfer
 *
 * Notes stay optional on that writer. Source allowlisting (`transfer_inventory`)
 * stays with #1269. Location-balance metadata provenance stays with its own tip.
 * Receipt, count, waste, stockout, usage, adjustment, and correction keep their
 * own evidence rules.
 */

export const INVENTORY_TRANSFER_REASON_CODES = ["station_transfer"] as const;

export type InventoryTransferReasonCode =
  (typeof INVENTORY_TRANSFER_REASON_CODES)[number];

export function isInventoryTransferReasonCode(
  value: unknown
): value is InventoryTransferReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_TRANSFER_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Domain rejection reason for transfer reason gaps.
 * Returns null when evidence is complete or the event is not a transfer.
 */
export function validateTransferReasonEvidence(input: {
  eventType: string;
  reasonCode: string | null;
}): string | null {
  if (input.eventType !== "transfer") return null;

  if (input.reasonCode == null || input.reasonCode.trim() === "") {
    return "transfer_requires_reason";
  }
  if (!isInventoryTransferReasonCode(input.reasonCode.trim())) {
    return "invalid_transfer_reason";
  }
  return null;
}
