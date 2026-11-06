import type { InventoryStatus } from "../../types/mise";

/**
 * Deterministic suggested-order quantity fact for inventory recommendations.
 *
 * Operators already see order size buried in recommendation prose. This fact
 * exposes the same planning quantity as a scannable number beside coverage —
 * only when Mise is actually recommending an order (Critical/Low) and the
 * projection is not contaminated. Watch/Good and contaminated projections stay
 * null rather than inventing a buy quantity.
 *
 * The value matches `InventoryPrediction.suggestedOrderQuantity` so pack
 * rounding and learned-quantity tips that refine that field stay coherent with
 * the detail fact. This is an explainable planning signal, not a fitted model.
 */
export function computeSuggestedOrderQuantityFact(input: {
  contaminatedProjection: boolean;
  projectedStatus: InventoryStatus;
  suggestedOrderQuantity: number;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }
  if (input.projectedStatus !== "Critical" && input.projectedStatus !== "Low") {
    return null;
  }
  if (!(input.suggestedOrderQuantity > 0)) {
    return null;
  }

  return input.suggestedOrderQuantity;
}
