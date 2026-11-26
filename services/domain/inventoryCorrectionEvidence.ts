/**
 * Audit evidence required for inventory correction ledger events.
 *
 * Hosted `record_inventory_event` already accepts correction for
 * owner/admin/manager and projects signed deltas onto on-hand. Without a
 * required operator note, a manager JWT can rewrite stock under correction
 * semantics with no comparable explanation of why the repair happened.
 *
 * Product writers that surface corrections in UI (#345 waste correction,
 * #350 receipt correction) already require a non-empty note and stamp it at
 * `metadata.note`. Source allowlisting, supersede linkage, and exact-reverse
 * quantity contracts stay with their own tips. Receipt, count, waste,
 * stockout, usage, adjustment, and transfer keep their own evidence rules.
 */

/**
 * Non-empty trimmed note nested under metadata.note.
 * Whitespace-only notes fail closed.
 */
export function inventoryCorrectionNoteFromMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const note = metadata.note;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Domain rejection reason for correction evidence gaps.
 * Returns null when evidence is complete or the event is not a correction.
 */
export function validateCorrectionEvidence(input: {
  eventType: string;
  metadata: Readonly<Record<string, unknown>>;
}): string | null {
  if (input.eventType !== "correction") return null;

  if (!inventoryCorrectionNoteFromMetadata(input.metadata)) {
    return "correction_requires_note";
  }
  return null;
}
