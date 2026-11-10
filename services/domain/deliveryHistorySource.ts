/**
 * Receipt-source classification for Log Delivery history.
 *
 * Ad-hoc Log Delivery posts `source = operator_receipt`. Order-path Mark
 * Received posts `source = supplier_delivery` (hosted). History used to show
 * both as identical quantity rows, so operators could not tell which path
 * increased on-hand. Soft-read only — never invent a supplier from free text
 * beyond the bounded metadata key already stamped by the write path.
 */

export const OPERATOR_RECEIPT_HISTORY_SOURCE = "operator_receipt" as const;
export const SUPPLIER_DELIVERY_HISTORY_SOURCE = "supplier_delivery" as const;

export type DeliveryHistorySourceKind =
  | "operator_receipt"
  | "supplier_delivery"
  | "other";

/** Soft-null supplier display name from receipt metadata. */
export function supplierNameFromDeliveryMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined | null
): string | null {
  if (!metadata) return null;
  const raw = metadata.supplierName;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Classify an inventory receipt source for history presentation. */
export function classifyDeliveryHistorySource(
  source: string | null | undefined
): DeliveryHistorySourceKind {
  const normalized = typeof source === "string" ? source.trim() : "";
  if (normalized === OPERATOR_RECEIPT_HISTORY_SOURCE) return "operator_receipt";
  if (normalized === SUPPLIER_DELIVERY_HISTORY_SOURCE) return "supplier_delivery";
  return "other";
}
