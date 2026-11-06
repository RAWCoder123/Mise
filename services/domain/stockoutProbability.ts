/**
 * Deterministic near-term stockout probability for inventory recommendations.
 *
 * When Mise can estimate a daily usage rate, this is the chance projected
 * on-hand reaches zero within the next two service days if demand continues
 * at that rate. It is a direct coverage-horizon calculation — not a fitted
 * statistical model — and stays null when Mise must not invent a rate
 * (contaminated projection or missing demand).
 *
 * Horizon is two service days so the signal stays useful beside days of
 * coverage: empty stock → 100%, one day of cover → 50%, two or more → 0%.
 */
export const STOCKOUT_PROBABILITY_HORIZON_DAYS = 2;

export function computeStockoutProbability(input: {
  projectedQuantity: number;
  averageDailyUsage: number;
  contaminatedProjection: boolean;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }
  if (!(input.averageDailyUsage > 0)) {
    return null;
  }

  const daysCoverage = Math.max(0, input.projectedQuantity) / input.averageDailyUsage;
  const probability = Math.max(
    0,
    Math.min(1, 1 - daysCoverage / STOCKOUT_PROBABILITY_HORIZON_DAYS)
  );
  return Math.round(probability * 100) / 100;
}
