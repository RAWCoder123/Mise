export type SupplierEmailDeliveryResolution = "confirm_sent" | "allow_retry";

export type SupplierEmailDeliveryReviewStatus =
  | "sending"
  | "sent"
  | "failed"
  | "unknown";

export interface SupplierEmailDeliveryReview {
  requiresReview: boolean;
  orderStatus: string;
  deliveryStatus: SupplierEmailDeliveryReviewStatus | null;
  lastErrorCode: string | null;
  updatedAt: string | null;
  providerMessageIdPresent: boolean;
  resolution: SupplierEmailDeliveryResolution | null;
  actionId: string | null;
  actionStatus: string | null;
}

export const CONFIRM_SENT_AFTER_REVIEW = "confirmed_sent_after_review";
export const AUTHORIZED_RETRY_AFTER_REVIEW = "authorized_retry_after_review";

export function confirmationForResolution(resolution: SupplierEmailDeliveryResolution) {
  return resolution === "confirm_sent"
    ? CONFIRM_SENT_AFTER_REVIEW
    : AUTHORIZED_RETRY_AFTER_REVIEW;
}

export function normalizeSupplierEmailDeliveryReview(
  value: unknown,
  restaurantId: string,
  orderId: string
): SupplierEmailDeliveryReview {
  if (!restaurantId.trim() || !orderId.trim()) {
    throw new Error("Supplier email delivery review requires restaurant and order ids.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Supplier email delivery review returned an invalid response.");
  }
  const row = value as Record<string, unknown>;
  const deliveryStatus = normalizeDeliveryStatus(row.deliveryStatus);
  const resolution = normalizeResolution(row.resolution);
  const updatedAt =
    typeof row.updatedAt === "string" && Number.isFinite(Date.parse(row.updatedAt))
      ? row.updatedAt
      : null;
  const lastErrorCode =
    typeof row.lastErrorCode === "string" && /^[a-z0-9_]{1,80}$/.test(row.lastErrorCode)
      ? row.lastErrorCode
      : null;
  const actionId =
    typeof row.actionId === "string" && row.actionId.trim().length > 0
      ? row.actionId.trim()
      : null;
  const actionStatus =
    typeof row.actionStatus === "string" && row.actionStatus.trim().length > 0
      ? row.actionStatus.trim()
      : null;
  const orderStatus =
    typeof row.orderStatus === "string" && row.orderStatus.trim().length > 0
      ? row.orderStatus.trim()
      : "draft";

  return {
    requiresReview: row.requiresReview === true,
    orderStatus,
    deliveryStatus,
    lastErrorCode,
    updatedAt,
    providerMessageIdPresent: row.providerMessageIdPresent === true,
    resolution,
    actionId,
    actionStatus
  };
}

export function supplierEmailDeliveryRequiresReview(
  review: SupplierEmailDeliveryReview | null | undefined,
  actionStatus?: string | null
) {
  if (review?.requiresReview) return true;
  return actionStatus === "unverified";
}

function normalizeDeliveryStatus(value: unknown): SupplierEmailDeliveryReviewStatus | null {
  if (value === "sending" || value === "sent" || value === "failed" || value === "unknown") {
    return value;
  }
  return null;
}

function normalizeResolution(value: unknown): SupplierEmailDeliveryResolution | null {
  if (value === "confirm_sent" || value === "allow_retry") return value;
  return null;
}
