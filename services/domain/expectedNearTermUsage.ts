/**
 * Deterministic expected near-term ingredient usage for inventory recommendations.
 *
 * When Mise can estimate a daily usage rate, this is how many units the
 * restaurant is expected to consume over the next seven service days if demand
 * continues at that rate. It turns the existing per-day rate into a planning
 * quantity operators can compare to on-hand and suggested order size — not a
 * fitted statistical model — and stays null when Mise must not invent a rate
 * (contaminated projection or missing demand).
 *
 * Horizon is seven service days so the signal stays useful beside days of
 * coverage and the near-term stockout / waste-risk windows without claiming a
 * longer seasonal forecast.
 */
export const EXPECTED_NEAR_TERM_USAGE_DAYS = 7;

export function computeExpectedNearTermUsage(input: {
  averageDailyUsage: number;
  contaminatedProjection: boolean;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }
  if (!(input.averageDailyUsage > 0)) {
    return null;
  }

  return Math.round(input.averageDailyUsage * EXPECTED_NEAR_TERM_USAGE_DAYS * 100) / 100;
}
