import { toDateKeyInTimeZone } from "../../utils/format";

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

export type ConfirmationDeliveryApplyRefusal =
  | "cross_tenant"
  | "order_mismatch"
  | "order_not_sent"
  | "rejected_or_unverified"
  | "missing_expected_delivery"
  | "invalid_expected_delivery"
  | "already_applied";

export type ConfirmationDeliveryApplyProposal =
  | {
      ok: true;
      deliveryDate: string;
      previousDeliveryDate: string | null;
      confirmationId: string;
      confirmationStatus: SupplierConfirmationStatus;
    }
  | {
      ok: false;
      reason: ConfirmationDeliveryApplyRefusal;
    };

export interface ConfirmationDeliveryApplyResult {
  outcome: "applied" | "already_applied";
  supplierOrderId: string;
  confirmationId: string;
  deliveryDate: string;
  previousDeliveryDate: string | null;
}

export interface SupplierConfirmationDeliveryApplyCandidate {
  confirmationId: string;
  status: SupplierConfirmationStatus;
  receivedAt: string;
  source: string;
  reference: string | null;
  expectedDeliveryAt: string;
  proposedDeliveryDate: string;
  currentDeliveryDate: string | null;
}

const APPLYABLE_STATUSES = new Set<SupplierConfirmationStatus>(["acknowledged", "changed"]);

/**
 * Converts a confirmation timestamp into the restaurant's calendar delivery date.
 * Returns null when the timestamp or timezone cannot form a YYYY-MM-DD key.
 */
export function deliveryDateKeyFromConfirmationAt(
  expectedDeliveryAt: string,
  timeZone: string
): string | null {
  const stamp = expectedDeliveryAt.trim();
  const zone = timeZone.trim() || "UTC";
  if (!stamp) return null;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return null;
  const key = toDateKeyInTimeZone(new Date(parsed), zone);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/**
 * Decides whether a single confirmation may rewrite a sent order's delivery_date.
 * Never invents a date: rejected/unverified confirmations and missing timestamps fail closed.
 */
export function proposeSupplierConfirmationDeliveryApply(input: {
  restaurantId: string;
  orderId: string;
  orderStatus: string;
  currentDeliveryDate: string | null;
  timeZone: string;
  confirmation: Pick<
    SupplierOrderConfirmationRecord,
    | "id"
    | "restaurant_id"
    | "supplier_order_id"
    | "confirmation_status"
    | "expected_delivery_at"
  >;
}): ConfirmationDeliveryApplyProposal {
  const restaurantId = input.restaurantId.trim();
  const orderId = input.orderId.trim();
  if (!restaurantId || input.confirmation.restaurant_id !== restaurantId) {
    return { ok: false, reason: "cross_tenant" };
  }
  if (!orderId || input.confirmation.supplier_order_id !== orderId) {
    return { ok: false, reason: "order_mismatch" };
  }
  if (input.orderStatus !== "sent") {
    return { ok: false, reason: "order_not_sent" };
  }
  if (!APPLYABLE_STATUSES.has(input.confirmation.confirmation_status)) {
    return { ok: false, reason: "rejected_or_unverified" };
  }
  if (!input.confirmation.expected_delivery_at?.trim()) {
    return { ok: false, reason: "missing_expected_delivery" };
  }
  const deliveryDate = deliveryDateKeyFromConfirmationAt(
    input.confirmation.expected_delivery_at,
    input.timeZone
  );
  if (!deliveryDate) {
    return { ok: false, reason: "invalid_expected_delivery" };
  }
  const previous = input.currentDeliveryDate?.trim() || null;
  if (previous === deliveryDate) {
    return { ok: false, reason: "already_applied" };
  }
  return {
    ok: true,
    deliveryDate,
    previousDeliveryDate: previous,
    confirmationId: input.confirmation.id,
    confirmationStatus: input.confirmation.confirmation_status
  };
}

/**
 * Latest-first confirmation that can update the sent order's expected delivery date.
 * Prefers `changed` over older `acknowledged` rows when both propose a new date.
 */
export function selectConfirmationDeliveryApplyCandidate(input: {
  restaurantId: string;
  orderId: string;
  orderStatus: string;
  currentDeliveryDate: string | null;
  timeZone: string;
  confirmations: readonly SupplierOrderConfirmationRecord[];
}): SupplierConfirmationDeliveryApplyCandidate | null {
  const ranked = [...input.confirmations].sort((left, right) =>
    right.received_at.localeCompare(left.received_at)
  );

  for (const confirmation of ranked) {
    const proposal = proposeSupplierConfirmationDeliveryApply({
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      orderStatus: input.orderStatus,
      currentDeliveryDate: input.currentDeliveryDate,
      timeZone: input.timeZone,
      confirmation
    });
    if (!proposal.ok) continue;
    return {
      confirmationId: proposal.confirmationId,
      status: proposal.confirmationStatus,
      receivedAt: confirmation.received_at,
      source: confirmation.source.trim(),
      reference: confirmation.confirmation_reference?.trim() || null,
      expectedDeliveryAt: confirmation.expected_delivery_at!.trim(),
      proposedDeliveryDate: proposal.deliveryDate,
      currentDeliveryDate: proposal.previousDeliveryDate
    };
  }
  return null;
}

export function normalizeSupplierOrderConfirmationRecord(
  value: unknown
): SupplierOrderConfirmationRecord {
  if (!value || typeof value !== "object") {
    throw new Error("Supplier confirmation record is invalid.");
  }
  const record = value as Record<string, unknown>;
  const status = record.confirmation_status;
  if (
    status !== "acknowledged" &&
    status !== "changed" &&
    status !== "rejected" &&
    status !== "unverified"
  ) {
    throw new Error("Supplier confirmation status is invalid.");
  }
  const id = requireText(record.id, "confirmation id");
  const restaurantId = requireText(record.restaurant_id, "restaurant");
  const orderId = requireText(record.supplier_order_id, "supplier order");
  const receivedAt = requireText(record.received_at, "received at");
  const source = requireText(record.source, "source");
  const idempotencyKey = requireText(record.idempotency_key, "idempotency key");
  const createdAt = requireText(record.created_at, "created at");
  return {
    id,
    restaurant_id: restaurantId,
    supplier_order_id: orderId,
    confirmation_status: status,
    confirmation_reference:
      typeof record.confirmation_reference === "string" && record.confirmation_reference.trim()
        ? record.confirmation_reference.trim()
        : null,
    expected_delivery_at:
      typeof record.expected_delivery_at === "string" && record.expected_delivery_at.trim()
        ? record.expected_delivery_at.trim()
        : null,
    received_at: receivedAt,
    source,
    idempotency_key: idempotencyKey,
    created_at: createdAt
  };
}

function requireText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${label}.`);
  }
  return value.trim();
}
