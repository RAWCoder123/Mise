import type { InventoryOutlookItem } from "../../types/mise";

/**
 * Projected on-hand inventory valuation from outlook rows.
 *
 * Uses projected quantity (POS-aware) and estimated unit cost. Items without a
 * positive finite unit cost are counted as unpriced and excluded from totals so
 * Mise never invents a dollar figure.
 */
export interface InventoryValuationSummary {
  itemCount: number;
  pricedItemCount: number;
  unpricedItemCount: number;
  /** Null when no priced items contribute — do not treat as $0 valued stock. */
  onHandValue: number | null;
  costCoverageComplete: boolean;
  atRiskItemCount: number;
  /** Null when no priced Critical/Low items contribute. */
  atRiskValue: number | null;
}

export function computeInventoryValuation(
  outlooks: readonly InventoryOutlookItem[] | null | undefined
): InventoryValuationSummary {
  if (!outlooks || outlooks.length === 0) {
    return {
      itemCount: 0,
      pricedItemCount: 0,
      unpricedItemCount: 0,
      onHandValue: null,
      costCoverageComplete: false,
      atRiskItemCount: 0,
      atRiskValue: null
    };
  }

  let pricedItemCount = 0;
  let unpricedItemCount = 0;
  let onHandTotal = 0;
  let atRiskItemCount = 0;
  let atRiskPricedCount = 0;
  let atRiskTotal = 0;

  for (const { item, prediction } of outlooks) {
    const unitCost = resolveUnitCost(item.estimated_unit_cost);
    const projectedQuantity = finiteNonNegative(prediction.projectedQuantity);
    const isAtRisk =
      prediction.projectedStatus === "Critical" || prediction.projectedStatus === "Low";

    if (isAtRisk) {
      atRiskItemCount += 1;
    }

    if (unitCost === null) {
      unpricedItemCount += 1;
      continue;
    }

    pricedItemCount += 1;
    onHandTotal += projectedQuantity * unitCost;

    if (isAtRisk) {
      atRiskPricedCount += 1;
      const shortfallToPar = Math.max(0, finiteNonNegative(item.par_level) - projectedQuantity);
      const exposedQty =
        shortfallToPar > 0 ? shortfallToPar : Math.max(0, finiteNonNegative(item.current_quantity));
      atRiskTotal += exposedQty * unitCost;
    }
  }

  const itemCount = outlooks.length;
  return {
    itemCount,
    pricedItemCount,
    unpricedItemCount,
    onHandValue: pricedItemCount > 0 ? roundCurrency(onHandTotal) : null,
    costCoverageComplete: itemCount > 0 && unpricedItemCount === 0,
    atRiskItemCount,
    atRiskValue: atRiskPricedCount > 0 ? roundCurrency(atRiskTotal) : null
  };
}

/** Dollars exposed on Critical/Low items — same contract as Daily Report stock risk. */
export function estimateInventoryDollarsAtRisk(
  outlooks: readonly InventoryOutlookItem[] | null | undefined
): number | null {
  return computeInventoryValuation(outlooks).atRiskValue;
}

function resolveUnitCost(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function finiteNonNegative(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
