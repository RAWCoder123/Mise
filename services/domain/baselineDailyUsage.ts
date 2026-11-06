/**
 * Deterministic historical baseline daily usage for inventory recommendations.
 *
 * This is the usual mapped demand rate Mise compares against today's sales —
 * the denominator behind demand intensity and the history half of blended
 * average daily usage. Operators need it as a structured fact so "usual"
 * demand is visible beside the blended per-day rate, rather than buried in
 * prose.
 *
 * Contaminated projections and missing positive baselines stay null so Mise
 * does not invent a usual rate from a single day or an invalid on-hand.
 */
export function computeBaselineDailyUsage(input: {
  contaminatedProjection: boolean;
  baselineUsage: number;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }
  if (!(input.baselineUsage > 0)) {
    return null;
  }
  if (!Number.isFinite(input.baselineUsage)) {
    return null;
  }

  return Math.round(input.baselineUsage * 100) / 100;
}
