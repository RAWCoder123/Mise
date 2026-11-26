/**
 * Audit evidence required for inventory transfer location provenance.
 *
 * Hosted `public.record_inventory_event` already accepts transfer for
 * owner/admin/manager. On current main, non-specialized projection adds the
 * event quantity to on-hand, so a forged transfer can rewrite stock under
 * transfer semantics with missing or free-form station provenance that cannot
 * be compared for Activity / station-transfer analysis.
 *
 * The production station-transfer writer (PR #1100 `transfer_inventory`) stamps:
 *   metadata.from_storage_location_id = <uuid>
 *   metadata.to_storage_location_id   = <uuid>
 * with distinct active locations in the same restaurant.
 *
 * This tip requires those two metadata fields as distinct UUID strings. It does
 * not create `storage_locations`, enforce FK membership, or require
 * `quantity_moved` — those stay with #1100 and follow-on tips. Reason-code and
 * source allowlisting stay with #1276 / #1269. Receipt, count, waste, stockout,
 * usage, adjustment, and correction keep their own evidence rules.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Trimmed UUID string from metadata, or null when missing / blank / non-UUID.
 */
export function inventoryTransferLocationIdFromMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined,
  key: "from_storage_location_id" | "to_storage_location_id"
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = metadata[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) return null;
  return trimmed;
}

/**
 * Domain rejection reason for transfer location gaps.
 * Returns null when evidence is complete or the event is not a transfer.
 */
export function validateTransferLocationEvidence(input: {
  eventType: string;
  metadata: Readonly<Record<string, unknown>>;
}): string | null {
  if (input.eventType !== "transfer") return null;

  const fromId = inventoryTransferLocationIdFromMetadata(
    input.metadata,
    "from_storage_location_id"
  );
  const toId = inventoryTransferLocationIdFromMetadata(
    input.metadata,
    "to_storage_location_id"
  );

  if (!fromId || !toId) {
    return "transfer_requires_locations";
  }
  if (fromId.toLowerCase() === toId.toLowerCase()) {
    return "invalid_transfer_locations";
  }
  return null;
}
