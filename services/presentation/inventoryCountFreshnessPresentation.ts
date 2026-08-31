import type { InventoryPrediction } from "../../types/mise";

/**
 * Operator-facing count-trust states derived from prediction evidence.
 * Contaminated chronology is included so Add-to-order can fail closed even
 * before specialized contaminated UI lands.
 */
export type InventoryCountTrustState = "trusted" | "stale" | "unverified" | "contaminated";

export function resolveInventoryCountTrustState(
  prediction: Pick<InventoryPrediction, "countEvidence" | "countFreshness">
): InventoryCountTrustState {
  if (prediction.countEvidence === "contaminated_projection") return "contaminated";
  if (prediction.countFreshness === "stale") return "stale";
  if (
    prediction.countFreshness === "unverified" ||
    prediction.countEvidence === "no_verified_count"
  ) {
    return "unverified";
  }
  return "trusted";
}

/** True when projected on-hand is safe to drive ordering decisions. */
export function inventoryProjectionAllowsAddToOrder(
  prediction: Pick<InventoryPrediction, "countEvidence" | "countFreshness">
): boolean {
  return resolveInventoryCountTrustState(prediction) === "trusted";
}

/** Stale or unverified counts that operators should recount (excludes contaminated). */
export function inventoryNeedsRecountForFreshness(
  prediction: Pick<InventoryPrediction, "countEvidence" | "countFreshness">
): boolean {
  const trust = resolveInventoryCountTrustState(prediction);
  return trust === "stale" || trust === "unverified";
}
