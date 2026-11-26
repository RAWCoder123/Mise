/**
 * Audit evidence required for inventory transfer movable-amount provenance.
 *
 * Hosted `public.record_inventory_event` already accepts transfer for
 * owner/admin/manager. On current main, non-specialized projection adds the
 * event quantity to on-hand, so a forged transfer can rewrite stock under
 * transfer semantics with no movable-amount evidence that Activity / station
 * transfer analysis can compare.
 *
 * The production station-transfer writer (PR #1100 `transfer_inventory`) stamps:
 *   metadata.quantity_moved = <finite number > 0>
 * alongside distinct from/to storage location ids (covered by tip #1277).
 *
 * This tip requires `metadata.quantity_moved` as a finite JSON/number value
 * strictly greater than zero. It does not force ledger `quantity = 0`
 * (leave-alone #1119/#374 and product #1100), create `storage_locations`, or
 * FK-check location ids. Location, reason-code, and source allowlisting stay
 * with their own tips.
 */

/**
 * Finite positive number from metadata.quantity_moved, or null when missing /
 * blank / non-numeric / not finite / <= 0.
 */
export function inventoryTransferQuantityMovedFromMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined
): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata.quantity_moved;
  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

/**
 * Domain rejection reason for transfer quantity_moved gaps.
 * Returns null when evidence is complete or the event is not a transfer.
 */
export function validateTransferQuantityMovedEvidence(input: {
  eventType: string;
  metadata: Readonly<Record<string, unknown>>;
}): string | null {
  if (input.eventType !== "transfer") return null;

  const quantityMoved = inventoryTransferQuantityMovedFromMetadata(input.metadata);
  if (quantityMoved == null) {
    return "transfer_requires_quantity_moved";
  }
  return null;
}
