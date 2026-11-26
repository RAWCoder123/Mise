/**
 * Audit evidence required when waste or stockout uses the catch-all reason
 * code `other`.
 *
 * Hosted `record_inventory_event` already accepts waste and stockout for
 * owner/admin/manager and projects them onto on-hand. Named reason codes from
 * the product taxonomies (#301 / #1098 waste; #366 stockout) are comparable on
 * their own. The catch-all `other` code is not: without a free-text note, a
 * manager JWT can rewrite stock under waste/stockout semantics with no
 * comparable explanation of what "other" meant.
 *
 * Product writers keep notes optional for named reasons. This guard only fires
 * when `reason_code` is exactly `other` (case-sensitive, matching the
 * allowlists in #1270 / #1271). Source allowlisting, full reason allowlists,
 * and UI/i18n stay with their own tips.
 */

/**
 * Non-empty trimmed note nested under metadata.note.
 * Whitespace-only notes fail closed.
 */
export function inventoryOtherReasonNoteFromMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const note = metadata.note;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Domain rejection reason when waste/stockout `other` lacks a note.
 * Returns null when evidence is complete or the rule does not apply.
 */
export function validateOtherReasonNoteEvidence(input: {
  eventType: string;
  reasonCode: string | null;
  metadata: Readonly<Record<string, unknown>>;
}): string | null {
  if (input.eventType !== "waste" && input.eventType !== "stockout") {
    return null;
  }
  // Exact match after the same trim record_inventory_event applies to reason_code.
  const reason = input.reasonCode?.trim() ?? "";
  if (reason !== "other") return null;

  if (!inventoryOtherReasonNoteFromMetadata(input.metadata)) {
    return input.eventType === "waste"
      ? "waste_other_requires_note"
      : "stockout_other_requires_note";
  }
  return null;
}
