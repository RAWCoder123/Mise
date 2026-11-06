/**
 * Deterministic demand-intensity ratio for inventory recommendations.
 *
 * Compares today's mapped POS demand against the historical baseline rate.
 * `1` means today matches the baseline; above `1` means hotter demand; below
 * `1` means cooler. Aligns with `demandTrend` thresholds (rising above 1.15,
 * falling below 0.8) so the numeric fact and the trend label stay coherent.
 *
 * This is an explainable ratio — not a fitted statistical model — and stays
 * null when Mise must not invent intensity (contaminated projection or no
 * positive baseline to compare against). A cold day with zero mapped sales
 * against a positive baseline is a real `0`, not null.
 */
export const DEMAND_INTENSITY_RISING_THRESHOLD = 1.15;
export const DEMAND_INTENSITY_FALLING_THRESHOLD = 0.8;

export function computeDemandIntensityRatio(input: {
  contaminatedProjection: boolean;
  todayMappedUsage: number;
  baselineUsage: number;
}): number | null {
  if (input.contaminatedProjection) {
    return null;
  }
  if (!(input.baselineUsage > 0)) {
    return null;
  }
  if (!Number.isFinite(input.todayMappedUsage) || input.todayMappedUsage < 0) {
    return null;
  }

  return Math.round((input.todayMappedUsage / input.baselineUsage) * 100) / 100;
}
