/**
 * Deterministic near-term waste / overstock risk for inventory recommendations.
 *
 * When Mise can estimate a daily usage rate, this is the chance current
 * projected coverage exceeds the restaurant's safe holding window and starts
 * creating spoil / cash-tied-up risk. It mirrors the existing coverage copy that
 * treats eight or more service days as "unusually high stock" — not a fitted
 * statistical model — and stays null when Mise must not invent a rate
 * (contaminated projection or missing demand).
 *
 * Holding horizon is eight service days so the signal stays useful beside days
 * of coverage and stockout risk: at or below the horizon → 0%, sixteen or more
 * days of cover → 100%, with linear growth in between.
 */
export const WASTE_RISK_HOLDING_DAYS = 8;

export function computeWasteRiskProbability(input: {
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
    Math.min(1, daysCoverage / WASTE_RISK_HOLDING_DAYS - 1)
  );
  return Math.round(probability * 100) / 100;
}
