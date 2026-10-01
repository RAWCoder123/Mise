import type {
  InventoryStatus,
  RecommendationStatus,
  SupplierOrderStatus
} from "../../types/mise";

/**
 * Consolidated operator-facing status vocabulary.
 * Prefer these labels in new operating surfaces; map legacy enums at boundaries.
 */

export type InventoryHealthLabel =
  | "Healthy"
  | "Watch"
  | "AtRisk"
  | "Critical"
  | "Unknown"
  | "Learning";

export type OrderOperationalStatus =
  | "Recommended"
  | "DraftedByMise"
  | "WaitingForApproval"
  | "Approved"
  | "Sent"
  | "SupplierConfirmed"
  | "PartiallyReceived"
  | "Received"
  | "Discrepancy"
  | "Cancelled"
  | "Failed"
  | "Unverified";

export type ExplicitActionStatus =
  | "Prepared"
  | "WaitingForApproval"
  | "Scheduled"
  | "Sent"
  | "Confirmed"
  | "Failed"
  | "CouldNotVerify"
  | "PartiallyCompleted"
  | "Cancelled"
  | "Reversed"
  | "Completed"
  | "Monitoring";

export type AutonomyLevel = 1 | 2 | 3 | 4 | 5;

const inventoryStatusMap: Record<InventoryStatus, InventoryHealthLabel> = {
  Good: "Healthy",
  Watch: "Watch",
  Low: "AtRisk",
  Critical: "Critical"
};

export function mapLegacyInventoryStatus(status: InventoryStatus): InventoryHealthLabel {
  return inventoryStatusMap[status];
}

/**
 * Prefer projected risk over a static "Healthy" label when depletion is imminent.
 * Never return Healthy when projected stockout is today or coverage is exhausted.
 */
export function resolveInventoryHealthLabel(input: {
  legacyStatus: InventoryStatus;
  projectedQuantity?: number | null;
  daysCoverage?: number | null;
  demandTrend?: "normal" | "rising" | "falling" | "learning";
  countFreshnessHours?: number | null;
}): InventoryHealthLabel {
  const {
    legacyStatus,
    projectedQuantity = null,
    daysCoverage = null,
    demandTrend,
    countFreshnessHours = null
  } = input;

  if (demandTrend === "learning" && (daysCoverage === null || !Number.isFinite(daysCoverage))) {
    return "Learning";
  }

  if (countFreshnessHours !== null && countFreshnessHours > 72 && legacyStatus === "Good") {
    return "Unknown";
  }

  if (projectedQuantity !== null && Number.isFinite(projectedQuantity) && projectedQuantity <= 0) {
    return "Critical";
  }

  if (daysCoverage !== null && Number.isFinite(daysCoverage) && daysCoverage <= 0) {
    return "Critical";
  }

  if (daysCoverage !== null && Number.isFinite(daysCoverage) && daysCoverage < 1) {
    return legacyStatus === "Critical" ? "Critical" : "AtRisk";
  }

  const mapped = mapLegacyInventoryStatus(legacyStatus);
  if (mapped === "Healthy" && daysCoverage !== null && Number.isFinite(daysCoverage) && daysCoverage < 1.5) {
    return "Watch";
  }
  return mapped;
}

export function mapRecommendationToOrderStatus(
  status: RecommendationStatus
): OrderOperationalStatus {
  switch (status) {
    case "pending":
      return "WaitingForApproval";
    case "approved":
      return "Approved";
    case "ordered":
      return "Sent";
    case "dismissed":
      return "Cancelled";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function mapSupplierOrderToOrderStatus(
  status: SupplierOrderStatus
): OrderOperationalStatus {
  switch (status) {
    case "draft":
      return "DraftedByMise";
    case "sent":
      return "Sent";
    case "completed":
      return "Received";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Combine recommendation + supplier order into one operational order status.
 * Prefer the more advanced durable state when both exist.
 */
export function resolveOrderOperationalStatus(input: {
  recommendationStatus?: RecommendationStatus | null;
  supplierOrderStatus?: SupplierOrderStatus | null;
  hasDiscrepancy?: boolean;
  supplierConfirmed?: boolean;
  partiallyReceived?: boolean;
  failed?: boolean;
}): OrderOperationalStatus {
  if (input.failed) return "Failed";
  if (input.hasDiscrepancy) return "Discrepancy";
  if (input.partiallyReceived) return "PartiallyReceived";
  if (input.supplierConfirmed) return "SupplierConfirmed";

  if (input.supplierOrderStatus) {
    return mapSupplierOrderToOrderStatus(input.supplierOrderStatus);
  }
  if (input.recommendationStatus) {
    return mapRecommendationToOrderStatus(input.recommendationStatus);
  }
  return "Unverified";
}

export function explicitActionStatusLabel(status: ExplicitActionStatus): string {
  switch (status) {
    case "Prepared":
      return "Prepared";
    case "WaitingForApproval":
      return "Waiting for approval";
    case "Scheduled":
      return "Scheduled";
    case "Sent":
      return "Sent";
    case "Confirmed":
      return "Confirmed";
    case "Failed":
      return "Failed";
    case "CouldNotVerify":
      return "Could not verify";
    case "PartiallyCompleted":
      return "Partially completed";
    case "Cancelled":
      return "Cancelled";
    case "Reversed":
      return "Reversed";
    case "Completed":
      return "Completed";
    case "Monitoring":
      return "Monitoring";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** English fallback for autonomy levels. Operator UI uses i18n `autonomy.levelName.*`. */
export function autonomyLevelLabel(level: AutonomyLevel): string {
  switch (level) {
    case 1:
      return "Observe";
    case 2:
      return "Recommend";
    case 3:
      return "Prepare";
    case 4:
      return "Execute";
    case 5:
      return "Optimize";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

/** Human label for order operational status. Keep in sync with i18n `orders.ops.*`. */
export function orderOperationalStatusLabel(status: OrderOperationalStatus): string {
  switch (status) {
    case "Recommended":
      return "Recommended";
    case "DraftedByMise":
      return "Drafted by Mise";
    case "WaitingForApproval":
      return "Waiting for approval";
    case "Approved":
      return "Approved";
    case "Sent":
      return "Sent";
    case "SupplierConfirmed":
      return "Supplier confirmed";
    case "PartiallyReceived":
      return "Partially received";
    case "Received":
      return "Received";
    case "Discrepancy":
      return "Discrepancy";
    case "Cancelled":
      return "Cancelled";
    case "Failed":
      return "Failed";
    case "Unverified":
      return "Unverified";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/**
 * Truthful mapping for the durable supplier-order statuses the app currently
 * stores. Does not invent SupplierConfirmed / PartiallyReceived / Discrepancy.
 */
export function presentSupportedSupplierOrderStatus(
  status: SupplierOrderStatus
): OrderOperationalStatus {
  return mapSupplierOrderToOrderStatus(status);
}

/**
 * Truthful mapping for recommendation review rows. Pending stays
 * WaitingForApproval; dismissed is Cancelled.
 */
export function presentSupportedRecommendationStatus(
  status: RecommendationStatus
): OrderOperationalStatus {
  return mapRecommendationToOrderStatus(status);
}
