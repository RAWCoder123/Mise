import { addDaysToDateKey } from "../../utils/format";

/**
 * Deterministic projected stockout calendar date for inventory recommendations.
 *
 * When Mise can estimate a daily usage rate, the projected stockout date is the
 * operating day when projected on-hand would reach zero at that rate. If on-hand
 * is already at or below zero, the date is the current operating date.
 *
 * Contaminated projections and missing demand rate stay null rather than
 * inventing a calendar date. Unlike the order-by date, a zero suggested order
 * quantity does not suppress the stockout date — operators can still run out
 * when no reorder is recommended.
 */
export function computeProjectedStockoutDate(input: {
  operatingDate: string;
  projectedQuantity: number;
  averageDailyUsage: number;
  contaminatedProjection: boolean;
}): { daysUntilStockout: number | null; projectedStockoutDate: string | null } {
  if (input.contaminatedProjection) {
    return { daysUntilStockout: null, projectedStockoutDate: null };
  }
  if (!(input.averageDailyUsage > 0)) {
    return { daysUntilStockout: null, projectedStockoutDate: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.operatingDate)) {
    return { daysUntilStockout: null, projectedStockoutDate: null };
  }

  const daysUntilStockout = Math.max(0, input.projectedQuantity / input.averageDailyUsage);
  const wholeDays = Math.floor(daysUntilStockout);
  return {
    daysUntilStockout,
    projectedStockoutDate: addDaysToDateKey(input.operatingDate, wholeDays)
  };
}
