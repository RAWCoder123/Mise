/**
 * Close a sent supplier order that never produced delivery evidence.
 *
 * Complementary to short-accept close (prior deliveries required): this path
 * requires zero supplier_deliveries and writes no inventory receipt.
 */

export const UNDELIVERED_CLOSE_REASONS = [
  "supplier_cancelled",
  "never_arrived",
  "ordered_in_error"
] as const;

export type UndeliveredCloseReason = (typeof UNDELIVERED_CLOSE_REASONS)[number];

export function normalizeUndeliveredCloseReason(value: unknown): UndeliveredCloseReason | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return (UNDELIVERED_CLOSE_REASONS as readonly string[]).includes(normalized)
    ? (normalized as UndeliveredCloseReason)
    : null;
}

export function requireUndeliveredCloseReason(value: unknown): UndeliveredCloseReason {
  const reason = normalizeUndeliveredCloseReason(value);
  if (!reason) {
    throw new Error("A bounded undelivered-close reason is required.");
  }
  return reason;
}

export function canCloseSupplierOrderUndelivered(input: {
  orderStatus: string;
  priorDeliveryCount: number;
}): boolean {
  return input.orderStatus === "sent" && input.priorDeliveryCount === 0;
}

export function undeliveredCloseReasonLabel(reason: UndeliveredCloseReason): string {
  switch (reason) {
    case "supplier_cancelled":
      return "Supplier cancelled";
    case "never_arrived":
      return "Delivery never arrived";
    case "ordered_in_error":
      return "Ordered in error";
  }
}
