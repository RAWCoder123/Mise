import { addDaysToDateKey } from "../../utils/format";

/**
 * Deterministic "order by" calendar date for inventory recommendations.
 *
 * When Mise can estimate a daily usage rate and a positive order quantity, the
 * suggested order-by date is the operating day when projected on-hand would
 * reach the reorder threshold. If the item is already at or below that
 * threshold, the date is the current operating date.
 *
 * Contaminated projections, missing demand rate, and no-order cases stay null
 * rather than inventing a calendar date.
 */
export function computeSuggestedOrderByDate(input: {
  operatingDate: string;
  projectedQuantity: number;
  reorderThreshold: number;
  averageDailyUsage: number;
  suggestedOrderQuantity: number;
  contaminatedProjection: boolean;
}): { daysUntilSuggestedOrder: number | null; suggestedOrderByDate: string | null } {
  if (input.contaminatedProjection) {
    return { daysUntilSuggestedOrder: null, suggestedOrderByDate: null };
  }
  if (!(input.averageDailyUsage > 0) || !(input.suggestedOrderQuantity > 0)) {
    return { daysUntilSuggestedOrder: null, suggestedOrderByDate: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.operatingDate)) {
    return { daysUntilSuggestedOrder: null, suggestedOrderByDate: null };
  }

  const daysUntilSuggestedOrder = Math.max(
    0,
    (input.projectedQuantity - input.reorderThreshold) / input.averageDailyUsage
  );
  const wholeDays = Math.floor(daysUntilSuggestedOrder);
  return {
    daysUntilSuggestedOrder,
    suggestedOrderByDate: addDaysToDateKey(input.operatingDate, wholeDays)
  };
}
