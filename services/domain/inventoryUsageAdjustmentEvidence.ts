/**
 * Audit evidence required for manager usage and adjustment ledger events.
 *
 * Hosted `record_inventory_event` already accepts these types for
 * owner/admin/manager and projects them onto on-hand. Without a bounded
 * reason taxonomy and a non-empty operator note, a manager JWT can rewrite
 * stock under usage/adjustment semantics with no comparable audit trail.
 *
 * Allowlists match the product writers that surface these types in UI
 * (usage: prep/staff_meal/tasting/training/other; adjustment:
 * found/lost/recount_delta/other). Receipt, count, waste, stockout,
 * transfer, and correction keep their own evidence rules.
 */

export const INVENTORY_USAGE_REASON_CODES = [
  "prep",
  "staff_meal",
  "tasting",
  "training",
  "other"
] as const;

export type InventoryUsageReasonCode = (typeof INVENTORY_USAGE_REASON_CODES)[number];

export const INVENTORY_ADJUSTMENT_REASON_CODES = [
  "found",
  "lost",
  "recount_delta",
  "other"
] as const;

export type InventoryAdjustmentReasonCode =
  (typeof INVENTORY_ADJUSTMENT_REASON_CODES)[number];

export function isInventoryUsageReasonCode(
  value: unknown
): value is InventoryUsageReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_USAGE_REASON_CODES as readonly string[]).includes(value)
  );
}

export function isInventoryAdjustmentReasonCode(
  value: unknown
): value is InventoryAdjustmentReasonCode {
  return (
    typeof value === "string" &&
    (INVENTORY_ADJUSTMENT_REASON_CODES as readonly string[]).includes(value)
  );
}

/**
 * Non-empty trimmed note nested under metadata.note.
 * Whitespace-only notes fail closed.
 */
export function inventoryEventNoteFromMetadata(
  metadata: Readonly<Record<string, unknown>> | null | undefined
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const note = metadata.note;
  if (typeof note !== "string") return null;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Domain rejection reason for usage/adjustment evidence gaps.
 * Returns null when evidence is complete.
 */
export function validateUsageOrAdjustmentEvidence(input: {
  eventType: string;
  reasonCode: string | null;
  metadata: Readonly<Record<string, unknown>>;
}): string | null {
  if (input.eventType === "usage") {
    if (input.reasonCode == null || input.reasonCode.trim() === "") {
      return "usage_requires_reason";
    }
    if (!isInventoryUsageReasonCode(input.reasonCode.trim())) {
      return "invalid_usage_reason";
    }
    if (!inventoryEventNoteFromMetadata(input.metadata)) {
      return "usage_requires_note";
    }
    return null;
  }

  if (input.eventType === "adjustment") {
    if (input.reasonCode == null || input.reasonCode.trim() === "") {
      return "adjustment_requires_reason";
    }
    if (!isInventoryAdjustmentReasonCode(input.reasonCode.trim())) {
      return "invalid_adjustment_reason";
    }
    if (!inventoryEventNoteFromMetadata(input.metadata)) {
      return "adjustment_requires_note";
    }
    return null;
  }

  return null;
}
