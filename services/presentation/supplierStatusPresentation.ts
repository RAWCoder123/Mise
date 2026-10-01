import type {
  SupplierReliabilityEntry,
  SupplierReliabilityStatus,
  SupplierReliabilitySummary
} from "../domain/supplierReliability";

export type SupplierStatusSectionId = "needs_follow_up" | "stable";

export interface SupplierStatusSection {
  id: SupplierStatusSectionId;
  suppliers: SupplierReliabilityEntry[];
}

/**
 * Partitions reliability evidence so operators see at-risk and watch suppliers
 * before reliable or still-learning ones. Preserves domain ordering inside each
 * section and never invents suppliers or reasons.
 */
export function partitionSupplierStatusSections(
  summary: SupplierReliabilitySummary
): SupplierStatusSection[] {
  const needsFollowUp: SupplierReliabilityEntry[] = [];
  const stable: SupplierReliabilityEntry[] = [];

  for (const supplier of summary.suppliers) {
    if (needsFollowUpStatus(supplier.status)) {
      needsFollowUp.push(supplier);
    } else {
      stable.push(supplier);
    }
  }

  const sections: SupplierStatusSection[] = [];
  if (needsFollowUp.length > 0) {
    sections.push({ id: "needs_follow_up", suppliers: needsFollowUp });
  }
  if (stable.length > 0) {
    sections.push({ id: "stable", suppliers: stable });
  }
  return sections;
}

/** Latest related order for follow-up when the supplier needs attention. */
export function primarySupplierFollowUpOrderId(
  supplier: SupplierReliabilityEntry
): string | null {
  if (!needsFollowUpStatus(supplier.status)) return null;
  const orderId = supplier.relatedOrderIds[0]?.trim();
  return orderId ? orderId : null;
}

export function supplierStatusTone(
  status: SupplierReliabilityStatus
): "danger" | "warning" | "success" | "neutral" {
  if (status === "at_risk") return "danger";
  if (status === "watch") return "warning";
  if (status === "reliable") return "success";
  return "neutral";
}

function needsFollowUpStatus(status: SupplierReliabilityStatus) {
  return status === "at_risk" || status === "watch";
}
