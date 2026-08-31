import type { InventoryItem, InventoryOutlookItem, InventoryStatus } from "../../types/mise";

export type InventoryHubFilter = "All" | "At risk" | "Watch" | "Good" | "Needs verification";

/**
 * Canonical pack conversions must be verified before count/receive/waste
 * ledger writes can proceed. Hub rows surface this as "needs verification".
 */
export function isInventoryCanonicalUnitReady(item: Pick<
  InventoryItem,
  "canonical_unit" | "canonical_unit_verification_status"
>): boolean {
  return (
    item.canonical_unit_verification_status === "verified" &&
    (item.canonical_unit === "g" || item.canonical_unit === "ml" || item.canonical_unit === "each")
  );
}

export function matchesInventoryStatusFilter(
  status: InventoryStatus,
  filter: Exclude<InventoryHubFilter, "Needs verification">
): boolean {
  if (filter === "All") return true;
  if (filter === "At risk") return status === "Critical" || status === "Low";
  return status === filter;
}

export function matchesInventoryHubFilter(
  outlook: Pick<InventoryOutlookItem, "item" | "prediction">,
  filter: InventoryHubFilter
): boolean {
  if (filter === "Needs verification") {
    return !isInventoryCanonicalUnitReady(outlook.item);
  }
  return matchesInventoryStatusFilter(outlook.prediction.projectedStatus, filter);
}

export function listNeedsVerificationOutlooks(
  outlooks: readonly InventoryOutlookItem[],
  limit?: number
): InventoryOutlookItem[] {
  const needsVerification = outlooks.filter(
    (outlook) => !isInventoryCanonicalUnitReady(outlook.item)
  );
  if (limit == null) return needsVerification;
  return needsVerification.slice(0, Math.max(0, limit));
}
