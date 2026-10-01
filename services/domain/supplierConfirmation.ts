export type SupplierConfirmationStatus =
  | "acknowledged"
  | "changed"
  | "rejected"
  | "unverified";

export interface SupplierOrderConfirmationRecord {
  id: string;
  restaurant_id: string;
  supplier_order_id: string;
  confirmation_status: SupplierConfirmationStatus;
  confirmation_reference: string | null;
  expected_delivery_at: string | null;
  received_at: string;
  source: string;
  idempotency_key: string;
  created_at: string;
}

export interface SupplierOrderConfirmationEvidence {
  confirmationId: string;
  status: SupplierConfirmationStatus;
  receivedAt: string;
  source: string;
  reference: string | null;
  expectedDeliveryAt: string | null;
}

export interface SupplierConfirmationRecordResult {
  confirmationId: string;
  supplierOrderId: string;
  status: SupplierConfirmationStatus;
  outcome: "applied" | "already_applied";
}

/**
 * Latest-first confirmation evidence for one supplier order detail screen.
 * Does not invent confirmation state from deliveries or order status alone.
 */
export function buildSupplierOrderConfirmationEvidence(input: {
  restaurantId: string;
  orderId: string;
  confirmations: readonly SupplierOrderConfirmationRecord[];
}): SupplierOrderConfirmationEvidence[] {
  const restaurantId = input.restaurantId.trim();
  const orderId = input.orderId.trim();
  if (!restaurantId) {
    throw new Error("Supplier confirmation evidence requires a restaurant workspace.");
  }
  if (!orderId) {
    throw new Error("Supplier confirmation evidence requires a supplier order.");
  }

  for (const confirmation of input.confirmations) {
    if (confirmation.restaurant_id !== restaurantId) {
      throw new Error("Supplier confirmation belongs to another restaurant.");
    }
  }

  return input.confirmations
    .filter((confirmation) => confirmation.supplier_order_id === orderId)
    .map((confirmation) => ({
      confirmationId: confirmation.id,
      status: confirmation.confirmation_status,
      receivedAt: confirmation.received_at,
      source: confirmation.source.trim(),
      reference: confirmation.confirmation_reference?.trim() || null,
      expectedDeliveryAt: confirmation.expected_delivery_at
    }))
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}

export function confirmationClientIdForOrder(orderId: string, recordedAt: string) {
  const normalizedOrderId = orderId.trim();
  const stamp = recordedAt.trim() || new Date().toISOString();
  if (!normalizedOrderId) throw new Error("Missing supplier order.");
  return `mgr-confirm:${normalizedOrderId}:${stamp}`;
}
